"""Minimal Launch (Job Scheduling) support for the Lumina backend path."""

from __future__ import annotations

import os
import subprocess
import time
from typing import Any, Optional

from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context


def launch(
    queue: str,
    job: str,
    *,
    project: Optional[str] = None,
    run_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Enqueue a LaunchJob into a LaunchQueue.

    ``queue`` and ``job`` can be IDs or names (resolved automatically).
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

    return client.create_launch_run(
        project_id,
        queue_id,
        job_id,
        run_id=run_id or ctx.run_id,
        metadata=metadata,
    )


def launch_agent(
    queue: str,
    *,
    project: Optional[str] = None,
    poll_interval: float = 2.0,
    max_runs: Optional[int] = None,
    dry_run: bool = False,
) -> list[dict[str, Any]]:
    """Poll a queue and execute pending launch runs locally.

    Set ``dry_run=True`` to mark runs as completed without executing commands.
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

        try:
            _execute_run(run)
            client.patch_launch_run(run_id, status="completed")
        except Exception as e:
            client.patch_launch_run(
                run_id,
                status="failed",
                metadata={"error": str(e)},
            )
        executed.append(run)

    return executed


def _resolve_queue(client: LuminaClient, project_id: str, reference: str) -> str:
    if len(reference) == 36 and reference.count("-") == 4:
        return reference
    queues = client.list_launch_queues(project_id)
    queue = next((q for q in queues.get("items", []) if q["name"] == reference), None)
    if not queue:
        raise ValueError(f"Queue not found: {reference}")
    return queue["id"]


def _resolve_job(client: LuminaClient, project_id: str, reference: str) -> str:
    if len(reference) == 36 and reference.count("-") == 4:
        return reference
    jobs = client.list_launch_jobs(project_id)
    job = next((j for j in jobs.get("items", []) if j["name"] == reference), None)
    if not job:
        raise ValueError(f"Job not found: {reference}")
    return job["id"]


def _execute_run(run: dict[str, Any]) -> None:
    job = run.get("job", {})
    command = job.get("command") or []
    args = job.get("args") or []
    env = {**os.environ, **(job.get("env") or {})}

    full_command = command + args
    if not full_command:
        return

    result = subprocess.run(
        full_command,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr or "Command failed")
