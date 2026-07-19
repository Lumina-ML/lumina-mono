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


def log_eval_summary(
    summary: Optional[dict[str, Any]] = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Record structured summary data for the current evaluation.

    Merges the given payload into ``Evaluation.summary`` (existing keys are
    preserved unless overwritten). This is where the dashboard's confusion
    matrix / PR curve / threshold sweep visualizations come from — the
    recognized keys are:

    - ``confusion_matrix``: ``{"labels": [...], "matrix": [[...], ...]}``
    - ``pr_curve``: ``[{"recall": .., "precision": ..}, ...]``
    - ``threshold_sweep``: ``[{"threshold": .., "precision": .., "recall": .., "f1": ..}, ...]``

    Any other scalar keys (e.g. ``accuracy``, ``num_samples``) are also
    surfaced as metric cards. Both positional dict and keyword forms work::

        lumina.log_eval_summary(accuracy=0.93, num_samples=1000)
        lumina.log_eval_summary({"confusion_matrix": cm})
    """
    ctx = get_run_context()
    if not ctx.eval_id:
        raise ValueError("No active evaluation. Call init_eval() first.")

    payload: dict[str, Any] = {}
    if summary:
        payload.update(summary)
    payload.update(kwargs)
    if not payload:
        raise ValueError("log_eval_summary requires at least one key")

    client = LuminaClient()
    # Merge with any summary already recorded so repeated calls accumulate
    # rather than clobber (PATCH replaces the summary field wholesale).
    existing = client.get_evaluation(ctx.eval_id).get("summary") or {}
    merged = {**existing, **payload}
    return client.patch_evaluation(ctx.eval_id, summary=merged)


def finish_eval(
    status: str = "completed",
    *,
    summary: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Finish the current evaluation, optionally recording a final summary."""
    ctx = get_run_context()
    if not ctx.eval_id:
        raise ValueError("No active evaluation. Call init_eval() first.")
    client = LuminaClient()
    if summary:
        existing = client.get_evaluation(ctx.eval_id).get("summary") or {}
        result = client.patch_evaluation(
            ctx.eval_id, status=status, summary={**existing, **summary}
        )
    else:
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
