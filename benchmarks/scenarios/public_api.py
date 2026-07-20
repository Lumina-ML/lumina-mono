"""Public API & Reports scenarios: RP-1, PA-1."""

from __future__ import annotations

import time

import lumina
from lumina.backend.public_api import LuminaPublicApi

from _common import Timer, check_server, ensure_auth
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
