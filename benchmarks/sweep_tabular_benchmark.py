"""Business benchmark: hyperparameter sweep over a tabular model.

Runs a Bayesian-optimization sweep against the Lumina backend to tune a
gradient-boosted-trees model, reporting each trial as its own run:
- sweep config with method=bayes, a val_rmse objective, and early termination
- one run per trial (created + logged by the sweep agent)
- best configuration registered to the Model Registry
- a summary LuminaReport

The "training" is synthesized: val_rmse is a smooth function of the
hyperparameters plus noise, with a decreasing per-step history so the
early-termination path is exercised.
"""

import math
import os
import random
import tempfile

import lumina
from _common import check_server, ensure_auth

PROJECT = "benchmark-sweep"


def train_gbdt(params: dict) -> dict:
    """Simulate training a GBDT and return the objective + a step history."""
    n_estimators = params["n_estimators"]
    max_depth = params["max_depth"]
    lr = params["learning_rate"]
    subsample = params["subsample"]

    # A synthetic bowl-shaped objective with a sensible optimum.
    rmse = (
        0.30
        + 0.5 * (math.log10(lr) + 2.0) ** 2 * 0.05
        + abs(max_depth - 6) * 0.02
        + abs(n_estimators - 300) / 300.0 * 0.1
        + (1.0 - subsample) * 0.1
    )
    rmse = max(0.05, rmse + random.uniform(-0.02, 0.02))

    # Decreasing per-step history (used for early-termination checks).
    history = [(step, round(rmse * (1.0 + 0.6 * math.exp(-step / 3)), 5)) for step in range(1, 9)]
    return {"val_rmse": round(rmse, 5), "history": history, "step": len(history)}


def main() -> None:
    check_server()
    ensure_auth("sweep")

    config = {
        "method": "bayes",
        "metric": {"name": "val_rmse", "goal": "minimize"},
        "parameters": {
            "n_estimators": {"values": [100, 200, 300, 500]},
            "max_depth": {"min": 3, "max": 10},
            "learning_rate": {"min": 0.01, "max": 0.3, "distribution": "log_uniform"},
            "subsample": {"min": 0.6, "max": 1.0},
        },
        "early_terminate": {"type": "hyperband", "min_iter": 2, "eta": 2},
    }

    sweep = lumina.sweep(config, project=PROJECT, name="gbdt-tuning")
    print(f"Sweep: {sweep['id']}")

    results = lumina.agent(sweep["id"], function=train_gbdt, count=8, project=PROJECT)
    scored = [r for r in results if isinstance(r["summary"].get("val_rmse"), (int, float))]
    best = min(scored, key=lambda r: r["summary"]["val_rmse"])
    print(f"Best trial: rmse={best['summary']['val_rmse']}  params={best['params']}")

    # Register the best model.
    with tempfile.NamedTemporaryFile("w", suffix=".pkl", delete=False) as f:
        f.write(f"best gbdt params: {best['params']}")
        model_path = f.name
    registered = lumina.log_model(
        path=model_path,
        name="gbdt-best",
        aliases=["best"],
        metadata={"val_rmse": best["summary"]["val_rmse"], **best["params"]},
        project=PROJECT,
    )
    print(f"Registered best model: {registered['version']['id']}")

    # Summary report over all trials.
    report = lumina.LuminaReport(title="GBDT Sweep Benchmark", project=PROJECT, created_by="benchmark")
    report.add_text(f"Ran {len(results)} Bayesian trials tuning a GBDT (objective: val_rmse).")
    report.add_metric("best_val_rmse", best["summary"]["val_rmse"])
    terminated = sum(1 for r in results if r.get("terminated"))
    report.add_metric("early_terminated_trials", terminated)
    report.add_run_gallery([r["run"]["runId"] for r in results])
    saved = report.save()
    print(f"Report: {saved['id']}  |  trials={len(results)}  early_terminated={terminated}")


if __name__ == "__main__":
    main()
