"""Experiment tracking scenarios: ET-1 ~ ET-2."""

from __future__ import annotations

import os
import random
import time

import lumina
from lumina.backend.client import LuminaClient

from _common import Timer, check_server, ensure_auth, loss_curve, resolve_project
from .base import Scenario, ScenarioResult


class ExperimentLifecycleScenario(Scenario):
    """ET-1: single run full lifecycle."""

    scenario_id = "ET-1"
    name = "Experiment lifecycle"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project_id = resolve_project("benchmark-et-lifecycle")

        with Timer() as t_init:
            run = lumina.init(
                project="benchmark-et-lifecycle",
                name=f"et1-{int(time.time())}-{random.randint(0, 9999)}",
                config={"lr": 0.01, "epochs": 10, "batch_size": 32},
            )

        run_id = run.run_id
        with Timer() as t_log:
            for step in range(5):
                run.log({"train/loss": 1.0 / (step + 1), "train/acc": step * 0.1}, step=step)

        with Timer() as t_finish:
            lumina.finish()

        # Basic correctness: run exists and is finished.
        client = LuminaClient()
        run_data = client.get_run(run_id)
        finished = run_data.get("status") == "finished"

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if finished else "failed",
            metrics={
                "init_ms": round(t_init.elapsed * 1000, 2),
                "log_ms": round(t_log.elapsed * 1000, 2),
                "finish_ms": round(t_finish.elapsed * 1000, 2),
            },
            assertions={"run_exists": run_data is not None, "status_finished": finished},
        )


class MetricThroughputScenario(Scenario):
    """ET-2: high-volume scalar metric ingestion."""

    scenario_id = "ET-2"
    name = "Metric throughput"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        params = self.params()
        steps = params["steps"]
        keys = ["train/loss", "train/acc", "val/loss", "val/acc"]

        run = lumina.init(
            project="benchmark-et-throughput",
            name=f"et2-{self.level}-{int(time.time())}",
            config={"keys_per_step": len(keys), "steps": steps},
        )
        run_id = run.run_id

        curves = {key: loss_curve(steps) for key in keys}

        with Timer() as t:
            for step in range(steps):
                run.log({key: curves[key][step] for key in keys}, step=step)
        lumina.finish()

        total_points = steps * len(keys)
        elapsed = max(t.elapsed, 1e-9)

        # Verify backend received expected number of metric points.
        client = LuminaClient()
        backend_metrics = client.list_metrics(run_id, limit=steps * len(keys))
        received = sum(len(pts) for pts in backend_metrics.get("metrics", {}).values())

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if received == total_points else "failed",
            metrics={
                "steps": steps,
                "keys_per_step": len(keys),
                "total_points": total_points,
                "elapsed_sec": round(elapsed, 3),
                "points/sec": round(total_points / elapsed, 1),
                "p95_ms": None,  # TODO: collect per-request latency
            },
            assertions={
                "count_match": received == total_points,
                "run_finished": client.get_run(run_id).get("status") == "finished",
            },
        )
