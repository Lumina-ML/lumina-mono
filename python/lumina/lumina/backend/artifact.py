"""Lumina backend Artifact support with manifest, dedup, lineage, and
reference artifacts.

Compared to the previous minimal implementation this adds:

- **Manifest** — ``save()`` now calls the server's finalize endpoint, which
  builds a canonical manifest of {path, digest, size, ...} entries and
  computes a sha256 over the whole manifest as the version's ``digest``.
- **Content-addressed dedup** — ``save()`` computes sha256 for every file
  and sends it to the server. Identical bytes within the same version share
  a single underlying storage object.
- **Reference artifacts** — ``add_reference(uri, path)`` registers a file
  pointing at an external URI without uploading anything.
- **Directory structure preserved** — ``add_dir()`` now records paths
  relative to the added directory, not bare basenames.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any, Optional, Union

from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context


class _PendingFile:
    """One entry the SDK intends to upload (or reference)."""

    __slots__ = ("path", "local", "reference_uri", "content_type")

    def __init__(
        self,
        path: str,
        local: Optional[Path] = None,
        reference_uri: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> None:
        self.path = path
        self.local = local
        self.reference_uri = reference_uri
        self.content_type = content_type


class LuminaArtifact:
    """A Lumina artifact with manifest + dedup + lineage support."""

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
        self._files: list[_PendingFile] = []
        self._client = LuminaClient()

    # ---- Add content -----------------------------------------------------

    def add_file(
        self,
        path: Union[str, Path],
        *,
        content_type: Optional[str] = None,
    ) -> "LuminaArtifact":
        """Add a single local file. Path is stored as the file's basename so
        a single ``add_file`` call keeps a flat manifest entry. Use
        ``add_dir`` to preserve sub-directory structure."""
        p = Path(path)
        if not p.is_file():
            raise FileNotFoundError(f"Not a file: {path}")
        self._files.append(_PendingFile(path=p.name, local=p, content_type=content_type))
        return self

    def add_dir(
        self,
        path: Union[str, Path],
        *,
        content_type: Optional[str] = None,
    ) -> "LuminaArtifact":
        """Recursively add all files in a directory. Stored paths are
        relative to ``path`` so the directory structure is preserved."""
        root = Path(path)
        if not root.is_dir():
            raise NotADirectoryError(f"Not a directory: {path}")
        for p in sorted(root.rglob("*")):
            if not p.is_file():
                continue
            rel = p.relative_to(root).as_posix()
            self._files.append(_PendingFile(path=rel, local=p, content_type=content_type))
        return self

    def add_reference(
        self,
        uri: str,
        path: Optional[str] = None,
        *,
        content_type: Optional[str] = None,
        size: int = 0,
    ) -> "LuminaArtifact":
        """Register an external reference artifact (no upload). ``path``
        defaults to the last URL path segment. ``size`` is optional metadata."""
        if not uri:
            raise ValueError("uri is required")
        if path is None:
            path = uri.rsplit("/", 1)[-1] or "reference"
        self._files.append(
            _PendingFile(
                path=path,
                reference_uri=uri,
                content_type=content_type,
            )
        )
        self._pending_ref_sizes: dict[str, int] = getattr(self, "_pending_ref_sizes", {})
        self._pending_ref_sizes[path] = size
        return self

    # ---- Save / finalize ------------------------------------------------

    def save(
        self,
        project: Optional[str] = None,
        version: str = "v0",
        aliases: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Create artifact + version, upload content, finalize."""
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
            artifacts = self._client._request(
                "GET", f"/api/v1/projects/{project_id}/artifacts"
            )
            artifact = next(
                (a for a in artifacts.get("items", []) if a["name"] == self.name),
                None,
            )
            if not artifact:
                raise

        version_obj = self._client.create_artifact_version(
            artifact["id"],
            version,
            aliases=aliases or ["latest"],
            metadata=self.metadata,
        )

        # Register + upload each file
        for entry in self._files:
            if entry.reference_uri:
                ref_sizes = getattr(self, "_pending_ref_sizes", {})
                self._client.add_artifact_file(
                    version_obj["id"],
                    entry.path,
                    size=ref_sizes.get(entry.path, 0),
                    reference_uri=entry.reference_uri,
                    content_type=entry.content_type,
                )
                continue

            data = entry.local.read_bytes()  # type: ignore[union-attr]
            sha = hashlib.sha256(data).hexdigest()
            file_meta = self._client.add_artifact_file(
                version_obj["id"],
                entry.path,
                size=len(data),
                sha256=sha,
                content_type=entry.content_type,
            )
            upload_url = file_meta.get("uploadUrl")
            if upload_url:
                self._client.upload_file_to_url(upload_url, data)

        # Finalize -> server builds manifest, computes digest, emits events
        try:
            self._client.finalize_artifact_version(version_obj["id"])
        except Exception:
            # Fallback for older servers without /finalize
            self._client.patch_artifact_version(version_obj["id"], state="committed")

        # Cache the last saved version id for tests + lineage helpers.
        self._saved_version_id = version_obj["id"]

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
    """Download a version's content files. Reference files (those without
    a ``downloadUrl``) are reported but not fetched."""
    client = LuminaClient()
    ctx = get_run_context()
    project_name = project or ctx.project
    if not project_name:
        raise ValueError("project is required when no run context exists")

    project_obj = client.get_project_by_name(project_name)
    if not project_obj:
        raise ValueError(f"Project not found: {project_name}")

    artifacts = client._request(
        "GET", f"/api/v1/projects/{project_obj['id']}/artifacts"
    )
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
    references: list[dict[str, Any]] = []
    for file_meta in files:
        download_url = file_meta.get("downloadUrl")
        rel_path = file_meta["path"]
        if not download_url:
            references.append(
                {
                    "path": rel_path,
                    "referenceUri": file_meta.get("referenceUri"),
                }
            )
            continue
        data = client.download_file_from_url(download_url)
        dest = target_dir / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        downloaded.append(dest)

    return {
        "artifact": artifact,
        "version": version_detail,
        "downloaded": [str(p) for p in downloaded],
        "references": references,
    }


def link_artifacts(
    child_version_id: str,
    parent_version_id: str,
    lineage_type: str = "derived_from",
) -> dict[str, Any]:
    """Attach a parent ArtifactVersion to a child. Records an edge in the
    ArtifactLineage table so downstream tooling can trace datasets → models."""
    client = LuminaClient()
    return client.attach_artifact_lineage(
        child_version_id, parent_version_id, lineage_type
    )


def unlink_artifacts(child_version_id: str, parent_version_id: str) -> None:
    """Remove a previously attached lineage edge."""
    client = LuminaClient()
    client.detach_artifact_lineage(child_version_id, parent_version_id)


def artifact_lineage(version_id: str) -> dict[str, Any]:
    """Return {parents, children} lineage edges for ``version_id``."""
    client = LuminaClient()
    return client.list_artifact_lineage(version_id)