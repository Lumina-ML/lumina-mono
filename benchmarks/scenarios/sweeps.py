"""Sweep scenarios: SW-1 ~ SW-2."""

from __future__ import annotations

import random
import time

import lumina
from lumina.backend.client import LuminaClient
from lumina.backend.sweep import get_sweep, list_observations

from _common import Timer, check_server, ensure_auth
from .base import Scenario, ScenarioResult


class BayesianSweepScenario(Scenario):
    """SW-1: Bayesian sweep with median early termination."""

    scenario_id = "SW-1"
    name = "Bayesian sweep with early termination"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-sweeps"
        params = self.params()
        count = max(6, params["concurrent_runs"] * 2)

        sweep_config = {
            "method": "bayes",
            "parameters": {
                "lr": {"min": 1e-4, "max": 1e-1, "distribution": "log_uniform"},
                "epochs": {"values": [5, 10, 15]},
            },
            "metric": {"name": "val/loss", "goal": "minimize"},
            "early_terminate": {"type": "median", "min_iter": 3},
        }

        sweep_obj = lumina.sweep(
            sweep_config,
            project=project,
            name=f"bench-bayes-{int(time.time())}",
        )
        sweep_id = sweep_obj["id"]

        def train(params: dict) -> dict:
            lr = float(params["lr"])
            # Higher lr -> higher loss; good runs should survive, bad ones pruned.
            base_loss = 0.5 + lr * 8.0
            history = []
            for step in range(1, 11):
                loss = base_loss + random.uniform(-0.05, 0.05) - step * 0.015
                history.append({"step": step, "val/loss": max(0.01, loss)})
            return {"val/loss": history[-1]["val/loss"], "history": history}

        with Timer() as t:
            results = lumina.agent(sweep_id, function=train, count=count, project=project)

        terminated = sum(1 for r in results if r.get("terminated"))
        finished = sum(1 for r in results if not r.get("terminated"))

        # Verify observations were recorded.
        observations = list_observations(sweep_id)
        sweep_detail = get_sweep(sweep_id)

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if observations else "failed",
            metrics={
                "trials": count,
                "terminated": terminated,
                "finished": finished,
                "elapsed_sec": round(t.elapsed, 3),
                "trials/sec": round(count / max(t.elapsed, 1e-9), 2),
                "observations": len(observations),
            },
            assertions={
                "sweep_created": bool(sweep_id),
                "observations_recorded": len(observations) > 0,
                "best_run_recorded": bool(sweep_detail.get("bestRunId")),
            },
        )


class ConcurrentSweepAgentsScenario(Scenario):
    """SW-2: multiple agents consuming the same sweep concurrently."""

    scenario_id = "SW-2"
    name = "Concurrent sweep agents"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-sweeps"
        params = self.params()
        agents = max(2, params["concurrent_runs"])
        trials_per_agent = 3

        sweep_config = {
            "method": "bayes",
            "parameters": {
                "lr": {"min": 1e-4, "max": 1e-1, "distribution": "log_uniform"},
            },
            "metric": {"name": "val/loss", "goal": "minimize"},
        }

        sweep_obj = lumina.sweep(
            sweep_config,
            project=project,
            name=f"bench-concurrent-{int(time.time())}",
        )
        sweep_id = sweep_obj["id"]

        def train(params: dict) -> dict:
            lr = float(params["lr"])
            loss = 0.5 + lr * 5.0 + random.uniform(-0.02, 0.02)
            return {"val/loss": loss}

        import concurrent.futures

        results: list[list[dict]] = []
        with Timer() as t:
            with concurrent.futures.ThreadPoolExecutor(max_workers=agents) as executor:
                futures = [
                    executor.submit(
                        lumina.agent, sweep_id, train, trials_per_agent, project
                    )
                    for _ in range(agents)
                ]
                for future in concurrent.futures.as_completed(futures):
                    results.append(future.result())

        all_run_ids: set[str] = set()
        for agent_result in results:
            for trial in agent_result:
                all_run_ids.add(trial["run"]["runId"])

        observations = list_observations(sweep_id)
        expected_total = agents * trials_per_agent

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if len(observations) == expected_total else "failed",
            metrics={
                "agents": agents,
                "trials_per_agent": trials_per_agent,
                "expected_total": expected_total,
                "unique_runs": len(all_run_ids),
                "observations": len(observations),
                "elapsed_sec": round(t.elapsed, 3),
                "trials/sec": round(expected_total / max(t.elapsed, 1e-9), 2),
            },
            assertions={
                "no_duplicate_runs": len(all_run_ids) == expected_total,
                "all_observations_recorded": len(observations) == expected_total,
            },
        )
