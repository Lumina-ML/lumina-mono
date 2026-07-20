"""Launch scenarios: LN-1 ~ LN-2."""

from __future__ import annotations

import concurrent.futures
import time

import lumina
from lumina.backend.client import LuminaClient

from _common import Timer, check_server, ensure_auth
from .base import Scenario, ScenarioResult


def _resolve_project(client: LuminaClient, name: str) -> str:
    project = client.get_project_by_name(name)
    if not project:
        project = client._request("POST", "/api/v1/projects", {"name": name})
    return project["id"]


class LaunchEnqueueExecuteScenario(Scenario):
    """LN-1: enqueue a launch run and execute it via a local agent."""

    scenario_id = "LN-1"
    name = "Launch enqueue/execute"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-launch"

        client = LuminaClient()
        project_id = _resolve_project(client, project)
        suffix = str(int(time.time()))
        queue_name = f"bench-queue-{suffix}"
        job_name = f"bench-job-{suffix}"

        queue = client.create_launch_queue(project_id, queue_name)
        job = client.create_launch_job(
            project_id,
            job_name,
            command=["python", "-c"],
            args=["print('hello from launch benchmark')"],
        )

        with Timer() as t:
            run = lumina.launch(queue_name, job_name, project=project)
            executed = lumina.launch_agent(
                queue_name,
                project=project,
                max_runs=1,
                poll_interval=0.5,
            )

        launch_run_id = run.get("id")
        detail = client.get_launch_run(launch_run_id)
        status = detail.get("status")

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if status == "completed" and len(executed) == 1 else "failed",
            metrics={
                "queue_id": queue["id"],
                "job_id": job["id"],
                "launch_run_id": launch_run_id,
                "executed_count": len(executed),
                "elapsed_sec": round(t.elapsed, 3),
            },
            assertions={
                "run_enqueued": bool(launch_run_id),
                "agent_executed": len(executed) == 1,
                "status_completed": status == "completed",
            },
        )


class ConcurrentLaunchAgentsScenario(Scenario):
    """LN-2: multiple agents concurrently consuming the same launch queue."""

    scenario_id = "LN-2"
    name = "Concurrent launch agents"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-launch"
        params = self.params()
        agents = max(2, params["concurrent_runs"])
        runs_per_agent = 2
        total = agents * runs_per_agent

        client = LuminaClient()
        project_id = _resolve_project(client, project)
        suffix = str(int(time.time()))
        queue_name = f"bench-concurrent-queue-{suffix}"
        job_name = f"bench-concurrent-job-{suffix}"

        queue = client.create_launch_queue(project_id, queue_name)
        job = client.create_launch_job(
            project_id,
            job_name,
            command=["python", "-c"],
            args=["print('concurrent launch benchmark')"],
        )

        for _ in range(total):
            lumina.launch(queue_name, job_name, project=project)

        with Timer() as t:
            with concurrent.futures.ThreadPoolExecutor(max_workers=agents) as executor:
                futures = [
                    executor.submit(
                        lumina.launch_agent,
                        queue_name,
                        project=project,
                        max_runs=runs_per_agent,
                        poll_interval=0.5,
                    )
                    for _ in range(agents)
                ]
                results: list[list[dict]] = [
                    future.result() for future in concurrent.futures.as_completed(futures)
                ]

        executed_count = sum(len(r) for r in results)
        queue_runs = client.list_launch_queue_runs(queue["id"]).get("items", [])
        completed_count = sum(1 for r in queue_runs if r.get("status") == "completed")

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if executed_count == total and completed_count == total else "failed",
            metrics={
                "agents": agents,
                "runs_per_agent": runs_per_agent,
                "expected_total": total,
                "executed_total": executed_count,
                "completed_total": completed_count,
                "elapsed_sec": round(t.elapsed, 3),
                "runs/sec": round(total / max(t.elapsed, 1e-9), 2),
            },
            assertions={
                "no_lost_runs": executed_count == total,
                "all_completed": completed_count == total,
            },
        )
