"""Experiment tracking scenarios: ET-1 ~ ET-5."""

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


class SystemMetricsAndLogsScenario(Scenario):
    """ET-3: system metrics and console logs ingestion."""

    scenario_id = "ET-3"
    name = "System metrics and logs"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        params = self.params()
        log_lines = min(params["log_lines"], 100)
        steps = min(params["steps"], 20)

        run = lumina.init(
            project="benchmark-et-system",
            name=f"et3-{self.level}-{int(time.time())}",
            config={"steps": steps, "log_lines": log_lines},
        )
        run_id = run.run_id

        with Timer() as t:
            for step in range(steps):
                lumina.log_system(
                    {
                        "cpu_percent": 20.0 + step * 2.5,
                        "memory_percent": 40.0 + step * 1.5,
                        "gpu_utilization": step * 5.0,
                    },
                    step=step,
                )

            for i in range(log_lines):
                level = "INFO" if i % 10 != 0 else "WARNING"
                lumina.log_line(f"benchmark log line {i}", level=level, step=i % steps)

        client = LuminaClient()
        system_metrics = client._request(
            "GET", f"/api/v1/runs/{run_id}/system-metrics?limit={steps * 10}"
        )
        logs = client._request("GET", f"/api/v1/runs/{run_id}/logs?limit={log_lines + 10}")

        lumina.finish()

        metrics_by_key = system_metrics.get("metrics", {})
        metric_points = sum(len(points) for points in metrics_by_key.values())
        log_items = logs.get("logs", [])

        expected_metrics = steps * 3  # 3 keys per step
        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if metric_points >= expected_metrics and len(log_items) >= log_lines else "failed",
            metrics={
                "steps": steps,
                "log_lines": log_lines,
                "system_metric_points": metric_points,
                "returned_logs": len(log_items),
                "elapsed_ms": round(t.elapsed * 1000, 2),
            },
            assertions={
                "system_metrics_recorded": metric_points >= expected_metrics,
                "logs_recorded": len(log_items) >= log_lines,
                "run_finished": client.get_run(run_id).get("status") == "finished",
            },
        )


class RunResumeRewindScenario(Scenario):
    """ET-4: run resume-state, should-stop, and rewind endpoints."""

    scenario_id = "ET-4"
    name = "Run resume/rewind"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-et-resume"

        client = LuminaClient()
        project_id = resolve_project(project)

        run = client.create_run(
            project=project,
            name=f"et4-{int(time.time())}",
            config={"lr": 0.01},
        )
        run_id = run["runId"]

        # Log some metrics so resume-state has data.
        for step in range(5):
            client.log_metrics(run_id, {"train/loss": 1.0 / (step + 1)}, step=step)

        with Timer() as t:
            resume_state = client.get_run_resume_state(run_id)
            should_stop = client.should_stop(run_id)

            # Rewind to the step whose train/loss == 0.5 (step 1).
            rewound = client.rewind_run(
                run_id,
                metric_name="train/loss",
                metric_value=0.5,
                program_path="train.py",
            )

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if bool(resume_state and rewound) else "failed",
            metrics={
                "run_id": run_id,
                "elapsed_ms": round(t.elapsed * 1000, 2),
            },
            assertions={
                "resume_state_non_empty": bool(resume_state),
                "should_stop_false": should_stop is False,
                "rewind_returned_state": bool(rewound),
            },
        )


class TagsAndNotesScenario(Scenario):
    """ET-5: attach tags and notes to a run."""

    scenario_id = "ET-5"
    name = "Tags and notes"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-et-tags"

        client = LuminaClient()
        project_id = resolve_project(project)

        run = client.create_run(
            project=project,
            name=f"et5-{int(time.time())}",
            config={"lr": 0.01},
        )
        run_id = run["runId"]

        with Timer() as t:
            notes = "Benchmark run notes for ET-5"
            client.update_run(run_id, notes=notes)
            client.add_tag(run_id, "baseline", color="#3b82f6")
            client.add_tag(run_id, "benchmark", color="#10b981")

        run_data = client.get_run(run_id)
        run_tags = client._request("GET", f"/api/v1/runs/{run_id}/tags").get("items", [])
        tag_names = {tag.get("name") for tag in run_tags}

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if run_data.get("notes") == notes and {"baseline", "benchmark"}.issubset(tag_names) else "failed",
            metrics={
                "run_id": run_id,
                "tag_count": len(run_tags),
                "elapsed_ms": round(t.elapsed * 1000, 2),
            },
            assertions={
                "notes_persisted": run_data.get("notes") == notes,
                "baseline_tag_present": "baseline" in tag_names,
                "benchmark_tag_present": "benchmark" in tag_names,
            },
        )
