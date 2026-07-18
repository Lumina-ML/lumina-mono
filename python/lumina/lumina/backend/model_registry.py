"""Minimal Model Registry support for the Lumina backend path."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

from lumina.backend.artifact import LuminaArtifact
from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context


def log_model(
    path: str | Path,
    name: str,
    description: Optional[str] = None,
    aliases: Optional[list[str]] = None,
    metadata: Optional[dict[str, Any]] = None,
    project: Optional[str] = None,
) -> dict[str, Any]:
    """Log a model file or directory to the Lumina Model Registry.

    Creates an Artifact of type ``model``, uploads the file(s), and links it as
    a new version of the named RegistryModel. The version auto-increments
    (v1, v2, ...) and ``latest`` is applied by default.
    """
    ctx = get_run_context()
    project_name = project or ctx.project
    if not project_name:
        raise ValueError("project is required when no run context exists")

    client = LuminaClient()
    project_obj = client.get_project_by_name(project_name)
    if not project_obj:
        project_obj = client._request("POST", "/api/v1/projects", {"name": project_name})
    project_id = project_obj["id"]

    # Reuse artifact upload machinery
    artifact = LuminaArtifact(name=name, type="model", description=description, metadata=metadata)
    target = Path(path)
    if target.is_file():
        artifact.add_file(target)
    elif target.is_dir():
        artifact.add_dir(target)
    else:
        raise FileNotFoundError(f"Not a file or directory: {path}")

    # Bump a unique artifact version so the registry version points to fresh files.
    import uuid
    artifact_version = artifact.save(project=project_name, version=f"v-{uuid.uuid4().hex[:8]}")

    # Create or get registry model
    try:
        model = client.create_registry_model(project_id, name, description)
    except Exception:
        models = client.list_registry_models(project_id)
        model = next(
            (m for m in models.get("items", []) if m["name"] == name),
            None,
        )
        if not model:
            raise

    version_aliases = [*(aliases or []), "latest"]
    registry_version = client.create_registry_model_version(
        model["id"],
        artifact_version["version"]["id"],
        aliases=list(dict.fromkeys(version_aliases)),
        metadata=metadata,
    )

    return {
        "model": model,
        "version": registry_version,
        "artifact_version": artifact_version["version"],
    }


def use_model(
    name: str,
    alias: str = "latest",
    project: Optional[str] = None,
    download_dir: Optional[str] = None,
) -> dict[str, Any]:
    """Download a model version from the Lumina Model Registry by alias."""
    client = LuminaClient()
    ctx = get_run_context()
    project_name = project or ctx.project
    if not project_name:
        raise ValueError("project is required when no run context exists")

    project_obj = client.get_project_by_name(project_name)
    if not project_obj:
        raise ValueError(f"Project not found: {project_name}")

    models = client.list_registry_models(project_obj["id"])
    model = next((m for m in models.get("items", []) if m["name"] == name), None)
    if not model:
        raise ValueError(f"Model not found in registry: {name}")

    versions = client.list_registry_model_versions(model["id"])
    version = next(
        (v for v in versions.get("items", []) if alias in (v.get("aliases") or [])),
        None,
    )
    if not version:
        raise ValueError(f"Version with alias '{alias}' not found for model {name}")

    version_detail = client.get_registry_model_version(version["id"])
    files = version_detail.get("artifactVersion", {}).get("files", [])

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
        "model": model,
        "version": version_detail,
        "downloaded": [str(p) for p in downloaded],
    }


def link_model(
    path: str | Path,
    name: str,
    aliases: Optional[list[str]] = None,
    project: Optional[str] = None,
) -> dict[str, Any]:
    """Convenience alias for ``log_model`` (common W&B naming)."""
    return log_model(path, name, aliases=aliases, project=project)
