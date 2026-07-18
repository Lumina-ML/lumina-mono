"""Minimal Evaluation support for the Lumina backend path."""

from __future__ import annotations

from typing import Any, Optional

from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context


def init_eval(
    name: str,
    *,
    dataset: Optional[str] = None,
    model: Optional[str] = None,
    project: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Create a new evaluation in the current project.

    ``dataset`` and ``model`` can be artifact version IDs, or for convenience
    the name of an artifact whose latest version will be resolved automatically.
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

    dataset_version_id = _resolve_artifact_version(client, project_id, dataset)
    model_version_id = _resolve_artifact_version(client, project_id, model)

    evaluation = client.create_evaluation(
        project_id,
        name,
        run_id=ctx.run_id,
        dataset_artifact_version_id=dataset_version_id,
        model_artifact_version_id=model_version_id,
        metadata=metadata,
    )

    # Mark as running and store in context
    client.patch_evaluation(evaluation["id"], status="running")
    ctx.eval_id = evaluation["id"]
    return client.get_evaluation(evaluation["id"])


def log_eval_result(
    key: str,
    value: float,
    metadata: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Log a single evaluation result for the current evaluation."""
    ctx = get_run_context()
    if not ctx.eval_id:
        raise ValueError("No active evaluation. Call init_eval() first.")
    client = LuminaClient()
    return client.add_evaluation_result(ctx.eval_id, key, value, metadata)


def finish_eval(status: str = "completed") -> dict[str, Any]:
    """Finish the current evaluation."""
    ctx = get_run_context()
    if not ctx.eval_id:
        raise ValueError("No active evaluation. Call init_eval() first.")
    client = LuminaClient()
    result = client.patch_evaluation(ctx.eval_id, status=status)
    ctx.eval_id = None
    return result


def _resolve_artifact_version(
    client: LuminaClient,
    project_id: str,
    reference: Optional[str],
) -> Optional[str]:
    if not reference:
        return None
    # If it looks like a UUID, assume it's already an artifact version id
    if len(reference) == 36 and reference.count("-") == 4:
        return reference

    # Otherwise treat as artifact name and resolve latest version
    artifacts = client._request("GET", f"/api/v1/projects/{project_id}/artifacts")
    artifact = next(
        (a for a in artifacts.get("items", []) if a["name"] == reference),
        None,
    )
    if not artifact:
        raise ValueError(f"Artifact not found: {reference}")

    versions = client._request("GET", f"/api/v1/artifacts/{artifact['id']}/versions")
    version = next(
        (v for v in versions.get("items", []) if "latest" in (v.get("aliases") or [])),
        None,
    )
    if not version:
        # Fall back to the most recent version
        version = versions.get("items", [])[0] if versions.get("items") else None
    if not version:
        raise ValueError(f"No versions found for artifact: {reference}")
    return version["id"]
