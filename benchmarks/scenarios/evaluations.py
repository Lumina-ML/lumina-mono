"""Evaluation scenarios: EV-1 ~ EV-2."""

from __future__ import annotations

import random
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


class EvaluationLifecycleScenario(Scenario):
    """EV-1: full evaluation lifecycle with dataset/model artifact refs."""

    scenario_id = "EV-1"
    name = "Evaluation lifecycle"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-eval-lifecycle"

        client = LuminaClient()
        project_id = _resolve_project(client, project)

        ts = int(time.time())
        dataset_name = f"bench-eval-dataset-{ts}"
        model_name = f"bench-eval-model-{ts}"

        dataset = lumina.LuminaArtifact(name=dataset_name, type="dataset")
        dataset.add_reference("s3://bench/dataset.parquet", "dataset.parquet", size=1024)
        ds_saved = dataset.save(project=project, version="v0")

        model = lumina.LuminaArtifact(name=model_name, type="model")
        model.add_reference("s3://bench/model.pt", "model.pt", size=2048)
        model_saved = model.save(project=project, version="v0")

        with Timer() as t:
            eval_obj = lumina.init_eval(
                name=f"ev1-{ts}",
                dataset=dataset_name,
                model=model_name,
                project=project,
                metadata={"task": "classification"},
            )

            lumina.log_eval_result("accuracy", 0.92)
            lumina.log_eval_result("f1", 0.91, metadata={"class": "macro"})

            lumina.log_eval_summary(
                num_samples=1000,
                accuracy=0.92,
                confusion_matrix={
                    "labels": ["cat", "dog"],
                    "matrix": [[92, 8], [7, 93]],
                },
            )

            finished = lumina.finish_eval("completed")

        eval_id = eval_obj["id"]
        fetched = client.get_evaluation(eval_id)
        results = client._request("GET", f"/api/v1/evaluations/{eval_id}/results")
        result_items = results.get("items", [])

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if fetched.get("status") == "completed" else "failed",
            metrics={
                "eval_id": eval_id,
                "elapsed_ms": round(t.elapsed * 1000, 2),
                "result_count": len(result_items),
            },
            assertions={
                "status_completed": fetched.get("status") == "completed",
                "result_count": len(result_items) == 2,
                "summary_accuracy": fetched.get("summary", {}).get("accuracy") == 0.92,
                "dataset_linked": fetched.get("datasetArtifactVersionId") == ds_saved["version"]["id"],
                "model_linked": fetched.get("modelArtifactVersionId") == model_saved["version"]["id"],
            },
        )


class EvaluationResultThroughputScenario(Scenario):
    """EV-2: high-volume evaluation result ingestion."""

    scenario_id = "EV-2"
    name = "Evaluation result throughput"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-eval-throughput"
        params = self.params()
        n = params.get("results_per_eval", 1000)

        eval_obj = lumina.init_eval(
            name=f"ev2-{self.level}-{int(time.time())}",
            project=project,
        )
        eval_id = eval_obj["id"]

        keys = ["accuracy", "precision", "recall", "f1"]
        with Timer() as t:
            for i in range(n):
                lumina.log_eval_result(keys[i % len(keys)], random.random())

        client = LuminaClient()
        results = client._request("GET", f"/api/v1/evaluations/{eval_id}/results")
        received = len(results.get("items", []))
        elapsed = max(t.elapsed, 1e-9)

        lumina.finish_eval("completed")
        final = client.get_evaluation(eval_id)

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if received == n else "failed",
            metrics={
                "results": n,
                "received": received,
                "elapsed_sec": round(elapsed, 3),
                "results/sec": round(n / elapsed, 1),
            },
            assertions={
                "count_match": received == n,
                "status_completed": final.get("status") == "completed",
            },
        )
