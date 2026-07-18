"""Minimal Artifact support for the Lumina backend path."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any, Optional

from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context


class LuminaArtifact:
    """A lightweight artifact for the Lumina backend."""

    def __init__(
        self,
        name: str,
        type: str = "file",
        description: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ):
        self.name = name
        self.type = type
        self.description = description
        self.metadata = metadata or {}
        self._files: list[Path] = []
        self._client = LuminaClient()

    def add_file(self, path: str | Path) -> "LuminaArtifact":
        """Add a local file to the artifact."""
        p = Path(path)
        if not p.is_file():
            raise FileNotFoundError(f"Not a file: {path}")
        self._files.append(p)
        return self

    def add_dir(self, path: str | Path) -> "LuminaArtifact":
        """Add all files in a directory recursively."""
        root = Path(path)
        if not root.is_dir():
            raise NotADirectoryError(f"Not a directory: {path}")
        for p in root.rglob("*"):
            if p.is_file():
                self._files.append(p)
        return self

    def save(self, project: Optional[str] = None, version: str = "v0") -> dict[str, Any]:
        """Create the artifact, version, and upload all files."""
        ctx = get_run_context()
        project_name = project or ctx.project
        if not project_name:
            raise ValueError("project is required when no run context exists")

        # Resolve project id
        project_obj = self._client.get_project_by_name(project_name)
        if not project_obj:
            project_obj = self._client._request(
                "POST", "/api/v1/projects", {"name": project_name}
            )
        project_id = project_obj["id"]

        # Create or get artifact
        try:
            artifact = self._client.create_artifact(
                project_id, self.name, self.type, self.description
            )
        except Exception:
            # Try to find existing artifact by listing
            artifacts = self._client._request("GET", f"/api/v1/projects/{project_id}/artifacts")
            artifact = next(
                (a for a in artifacts.get("items", []) if a["name"] == self.name),
                None,
            )
            if not artifact:
                raise

        # Create version
        version_obj = self._client.create_artifact_version(
            artifact["id"],
            version,
            aliases=["latest"],
            metadata=self.metadata,
        )

        # Register and upload files
        for p in self._files:
            rel_path = p.name
            data = p.read_bytes()
            size = len(data)
            file_meta = self._client.add_artifact_file(
                version_obj["id"], rel_path, size
            )
            upload_url = file_meta["uploadUrl"]
            self._client.upload_file_to_url(upload_url, data)

        # Commit version
        self._client.patch_artifact_version(version_obj["id"], state="committed")

        return {
            "artifact": artifact,
            "version": self._client.get_artifact_version(version_obj["id"]),
        }


def use_lumina_artifact(
    name: str,
    project: Optional[str] = None,
    alias: str = "latest",
    download_dir: Optional[str] = None,
) -> dict[str, Any]:
    """Download an artifact version by name and alias."""
    client = LuminaClient()
    ctx = get_run_context()
    project_name = project or ctx.project
    if not project_name:
        raise ValueError("project is required when no run context exists")

    project_obj = client.get_project_by_name(project_name)
    if not project_obj:
        raise ValueError(f"Project not found: {project_name}")

    artifacts = client._request("GET", f"/api/v1/projects/{project_obj['id']}/artifacts")
    artifact = next(
        (a for a in artifacts.get("items", []) if a["name"] == name),
        None,
    )
    if not artifact:
        raise ValueError(f"Artifact not found: {name}")

    versions = client._request("GET", f"/api/v1/artifacts/{artifact['id']}/versions")
    version = next(
        (v for v in versions.get("items", []) if alias in (v.get("aliases") or [])),
        None,
    )
    if not version:
        raise ValueError(f"Version with alias '{alias}' not found for artifact {name}")

    version_detail = client.get_artifact_version(version["id"])
    files = version_detail.get("files", [])

    target_dir = Path(download_dir or os.getcwd())
    target_dir.mkdir(parents=True, exist_ok=True)

    downloaded: list[Path] = []
    for file_meta in files:
        download_url = file_meta.get("downloadUrl")
        if not download_url:
            continue
        data = client.download_file_from_url(download_url)
        dest = target_dir / file_meta["path"]
        dest.write_bytes(data)
        downloaded.append(dest)

    return {
        "artifact": artifact,
        "version": version_detail,
        "downloaded": [str(p) for p in downloaded],
    }
