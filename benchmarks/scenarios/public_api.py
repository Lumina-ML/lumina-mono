"""Public API & Reports scenarios: RP-1, PA-1."""

from __future__ import annotations

import time

import lumina
from lumina.backend.client import LuminaClient
from lumina.backend.public_api import LuminaPublicApi

from _common import Timer, check_server, ensure_auth, resolve_project
from .base import Scenario, ScenarioResult


class PublicApiQueryScenario(Scenario):
    """PA-1: query runs and projects through the read-only Public API."""

    scenario_id = "PA-1"
    name = "Public API runs/projects query"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-public-api"

        # Seed a few runs so the query has data.
        run_ids = []
        for i in range(3):
            run = lumina.init(
                project=project,
                name=f"pa1-run-{int(time.time())}-{i}",
                config={"seed": i},
            )
            run.log({"metric": float(i)})
            lumina.finish()
            run_ids.append(run.run_id)

        api = LuminaPublicApi()

        with Timer() as t_runs:
            runs = api.runs(project=project)
        with Timer() as t_projects:
            projects = api.projects()

        queried_run_ids = {r.get("runId") for r in runs}

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if all(rid in queried_run_ids for rid in run_ids) else "failed",
            metrics={
                "seeded_runs": len(run_ids),
                "queried_runs": len(runs),
                "queried_projects": len(projects),
                "runs_query_ms": round(t_runs.elapsed * 1000, 2),
                "projects_query_ms": round(t_projects.elapsed * 1000, 2),
            },
            assertions={
                "all_runs_visible": all(rid in queried_run_ids for rid in run_ids),
                "projects_non_empty": len(projects) > 0,
            },
        )


class ReportLifecycleScenario(Scenario):
    """RP-1: create, read, patch, and list a report with blocks."""

    scenario_id = "RP-1"
    name = "Report lifecycle"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-reports"

        client = LuminaClient()
        project_id = resolve_project(project)

        # Seed a run so the run_gallery block is meaningful.
        run = lumina.init(
            project=project,
            name=f"rp1-run-{int(time.time())}",
            config={"lr": 0.01},
        )
        lumina.log({"score": 0.95}, step=0)
        lumina.finish()

        blocks = [
            {"type": "text", "text": "Benchmark report"},
            {"type": "metric", "key": "score", "value": 0.95, "step": 0},
            {"type": "run_gallery", "runIds": [run.run_id]},
        ]

        with Timer() as t_create:
            report = client.create_report(
                project_id,
                title=f"RP-1 Report {int(time.time())}",
                blocks=blocks,
                created_by="benchmark",
            )

        report_id = report["id"]
        refreshed = client.get_report(report_id)

        with Timer() as t_patch:
            patched = client.patch_report(
                report_id,
                title=report["title"] + " (updated)",
                blocks=blocks + [{"type": "text", "text": "updated"}],
            )

        listed = client.list_reports(project_id)
        all_reports = listed.get("items", [])

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if refreshed.get("id") == report_id else "failed",
            metrics={
                "report_id": report_id,
                "create_ms": round(t_create.elapsed * 1000, 2),
                "patch_ms": round(t_patch.elapsed * 1000, 2),
                "listed_count": len(all_reports),
            },
            assertions={
                "created": bool(report_id),
                "refreshed": refreshed.get("id") == report_id,
                "patched": patched.get("title", "").endswith("(updated)"),
                "listed": any(r.get("id") == report_id for r in all_reports),
            },
        )
