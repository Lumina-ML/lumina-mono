"""Lumina backend Launch (Job Scheduling) with builder/runner/registry/environment abstractions.

Public surface:

- Top-level :func:`launch` (enqueue) and :func:`launch_agent` (consume) —
  backwards-compatible with the original minimal launch module.
- :class:`AbstractBuilder` / :class:`NoopBuilder` / :class:`DockerBuilder`
- :class:`AbstractRunner` / :class:`LocalProcessRunner` / :class:`LocalContainerRunner`
- :class:`AbstractRegistry` / :class:`LocalRegistry` / :class:`S3Registry`
- :class:`AbstractEnvironment` / :class:`LocalEnvironment` / :class:`AWSEnvironment`

The agent loop now uses the runner abstraction so a job with an ``image``
field can be dispatched to :class:`LocalContainerRunner` (docker) while a
job with no image stays on :class:`LocalProcessRunner` (subprocess).
"""

from __future__ import annotations

import os
import time
from typing import Any, Optional

from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context

from .builder import AbstractBuilder, BuildResult, DockerBuilder, NoopBuilder
from .environment import (
    AWSEnvironment,
    AbstractEnvironment,
    EnvironmentSpec,
    LocalEnvironment,
)
from .loader import (
    builder_from_config,
    environment_from_config,
    registry_from_config,
    runner_from_config,
)
from .registry import AbstractRegistry, LocalRegistry, RegistryImage, S3Registry
from .runner import (
    AbstractRunner,
    LocalContainerRunner,
    LocalProcessRunner,
    RunResult,
    select_runner,
)


def launch(
    queue: str,
    job: str,
    *,
    project: Optional[str] = None,
    run_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    builder: Optional[AbstractBuilder] = None,
    registry: Optional[AbstractRegistry] = None,
) -> dict[str, Any]:
    """Enqueue a LaunchJob into a LaunchQueue.

    ``queue`` and ``job`` can be IDs or names (resolved automatically).
    Pass ``builder`` / ``registry`` to optionally produce a built image
    URI that gets stamped on the run metadata.
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

    queue_id = _resolve_queue(client, project_id, queue)
    job_id = _resolve_job(client, project_id, job)

    metadata = dict(metadata or {})
    if builder is not None:
        result: BuildResult = builder.build(job_name=job_id)
        metadata.setdefault("image_uri", result.image_uri)
        if result.digest:
            metadata.setdefault("image_digest", result.digest)
    if registry is not None:
        metadata.setdefault("registry_uri", registry.uri)

    return client.create_launch_run(
        project_id,
        queue_id,
        job_id,
        run_id=run_id or ctx.run_id,
        metadata=metadata or None,
    )


def launch_agent(
    queue: str,
    *,
    project: Optional[str] = None,
    poll_interval: float = 2.0,
    max_runs: Optional[int] = None,
    dry_run: bool = False,
    config: Optional[dict[str, Any]] = None,
    runner: Optional[AbstractRunner] = None,
) -> list[dict[str, Any]]:
    """Poll a queue and execute pending launch runs.

    The runner is selected automatically:

    - If a custom ``runner`` is supplied, use it.
    - Otherwise the runner is built from ``config`` (via ``runner_from_config``)
      and falls back to :class:`LocalContainerRunner` when ``job.image``
      is set, or :class:`LocalProcessRunner` otherwise.
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

    queue_id = _resolve_queue(client, project_id, queue)

    # Resolve runner. We pre-build one Docker-aware runner so jobs that
    # specify an image can share the same docker binary invocation path.
    default_runner = runner or runner_from_config(config)
    if isinstance(default_runner, LocalContainerRunner):
        docker_runner = default_runner
    else:
        docker_runner = LocalContainerRunner()

    executed: list[dict[str, Any]] = []
    count = 0
    while max_runs is None or count < max_runs:
        run = client.dequeue_launch_run(queue_id)
        if not run:
            time.sleep(poll_interval)
            continue

        count += 1
        run_id = run["id"]
        client.patch_launch_run(run_id, status="running")

        if dry_run:
            client.patch_launch_run(run_id, status="completed")
            executed.append(run)
            continue

        chosen = select_runner(run, docker_runner=docker_runner) if runner is None else default_runner
        try:
            result: RunResult = chosen.run(run)
            if result.ok:
                client.patch_launch_run(
                    run_id,
                    status="completed",
                    metadata={"image_uri": result.image_uri, "runner_type": result.runner_type} if result.image_uri else {"runner_type": result.runner_type},
                )
            else:
                client.patch_launch_run(
                    run_id,
                    status="failed",
                    metadata={
                        "exit_code": result.exit_code,
                        "stderr": result.stderr[-4000:],  # cap size
                        "runner_type": result.runner_type,
                    },
                )
        except Exception as e:
            client.patch_launch_run(
                run_id,
                status="failed",
                metadata={"error": str(e)},
            )
        executed.append(run)

    return executed


def _resolve_queue(client: LuminaClient, project_id: str, reference: str) -> str:
    return _resolve_resource(client, project_id, reference, "queues")


def _resolve_job(client: LuminaClient, project_id: str, reference: str) -> str:
    return _resolve_resource(client, project_id, reference, "jobs")


def _resolve_resource(
    client: LuminaClient, project_id: str, reference: str, kind: str
) -> str:
    """Resolve a queue/job reference. UUID-shaped strings are passed
    through verbatim; everything else is looked up first by id, then by
    name, so callers can pass either an opaque id (e.g. ``q-1``) or a
    human-friendly name."""
    if len(reference) == 36 and reference.count("-") == 4:
        return reference
    if kind == "queues":
        items = client.list_launch_queues(project_id).get("items", [])
    else:
        items = client.list_launch_jobs(project_id).get("items", [])
    match = next((q for q in items if q["id"] == reference), None) or next(
        (q for q in items if q["name"] == reference), None
    )
    if not match:
        raise ValueError(f"Launch {kind[:-1].capitalize()} not found: {reference}")
    return match["id"]


__all__ = [
    # Top-level API
    "launch",
    "launch_agent",
    # Builder
    "AbstractBuilder",
    "BuildResult",
    "DockerBuilder",
    "NoopBuilder",
    # Runner
    "AbstractRunner",
    "LocalContainerRunner",
    "LocalProcessRunner",
    "RunResult",
    "select_runner",
    # Registry
    "AbstractRegistry",
    "LocalRegistry",
    "RegistryImage",
    "S3Registry",
    # Environment
    "AbstractEnvironment",
    "AWSEnvironment",
    "EnvironmentSpec",
    "LocalEnvironment",
    # Loader
    "builder_from_config",
    "environment_from_config",
    "registry_from_config",
    "runner_from_config",
]