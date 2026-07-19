"""SDK tests for the Bayesian + Early-Terminate sweep integration."""

from __future__ import annotations

from typing import Any

import pytest

from lumina.backend.sweep import agent, list_observations, sweep


pytest_plugins = ["fake_backend"]


@pytest.fixture
def lumina_env(monkeypatch: pytest.MonkeyPatch, fake_backend: tuple[str, Any]):
    base_url, backend = fake_backend
    monkeypatch.setenv("LUMINA_API_URL", base_url)
    monkeypatch.setenv("LUMINA_API_KEY", "test-key")
    from lumina.backend import run_context as _rc
    _rc.reset_run_context()
    _rc.get_run_context().project = "demo"
    yield backend
    _rc.reset_run_context()


def test_sweep_creates_then_lists_via_agent(lumina_env):
    sweep_obj = sweep(
        {
            "method": "random",
            "parameters": {"lr": {"min": 0.001, "max": 0.1}},
            "metric": {"name": "loss", "goal": "minimize"},
        },
        project="demo",
        name="s1",
    )
    assert sweep_obj["id"].startswith("sweep-")
    fetched = lumina_env.get_sweep(sweep_obj["id"])
    assert fetched["name"] == "s1"


def test_agent_runs_random_trials(lumina_env):
    sweep_obj = sweep(
        {
            "method": "random",
            "parameters": {"lr": {"values": [0.001, 0.01, 0.1]}},
            "metric": {"name": "loss", "goal": "minimize"},
        },
        project="demo",
        name="rand",
    )

    results = agent(sweep_obj["id"], count=3, function=lambda p: {"loss": 0.1})
    assert len(results) == 3
    for r in results:
        assert "run" in r
        assert r["summary"]["loss"] == 0.1


def test_agent_calls_server_suggest_for_bayes(lumina_env):
    sweep_obj = sweep(
        {
            "method": "bayes",
            "parameters": {"lr": {"min": 0.001, "max": 0.1, "distribution": "log_uniform"}},
            "metric": {"name": "loss", "goal": "minimize"},
        },
        project="demo",
        name="bayes",
    )

    # Seed enough observations to trigger server-side GP path. With our
    # fake backend, observations need to be on rows in _SWEEP_RUNS.
    lumina_env.seed_sweep_runs(
        sweep_obj["id"],
        [
            {"runId": "r1", "params": {"lr": 0.005}, "metric": 0.4, "status": "finished"},
            {"runId": "r2", "params": {"lr": 0.05}, "metric": 0.6, "status": "finished"},
        ],
    )

    results = agent(sweep_obj["id"], count=2, function=lambda p: {"loss": 0.2})
    assert len(results) == 2
    obs = lumina_env.get_sweep_observations(sweep_obj["id"])
    # Server-side suggest returned "candidate" dicts with lr in the [min,max] range.
    for r in results:
        assert 0.001 <= r["params"]["lr"] <= 0.1


def test_agent_early_terminate_stops_underperforming_run(lumina_env):
    sweep_obj = sweep(
        {
            "method": "random",
            "parameters": {"lr": {"values": [0.01]}},
            "metric": {"name": "loss", "goal": "minimize"},
            "early_terminate": {"type": "median", "min_iter": 1},
        },
        project="demo",
        name="et",
    )
    # Seed three peers with better (lower) loss metrics than the test trial.
    lumina_env.seed_sweep_runs(
        sweep_obj["id"],
        [
            {"runId": "p1", "params": {"lr": 0.01}, "metric": 0.2, "status": "finished"},
            {"runId": "p2", "params": {"lr": 0.01}, "metric": 0.3, "status": "finished"},
            {"runId": "p3", "params": {"lr": 0.01}, "metric": 0.4, "status": "finished"},
        ],
    )

    results = agent(sweep_obj["id"], count=1, function=lambda p: {"loss": 0.9})
    assert results[0]["terminated"] is True
    assert results[0]["summary"]["_early_terminated"]["reason"] == "test"


def test_agent_records_best_run_after_loop(lumina_env):
    sweep_obj = sweep(
        {
            "method": "random",
            "parameters": {"lr": {"values": [0.01]}},
            "metric": {"name": "loss", "goal": "minimize"},
        },
        project="demo",
        name="best",
    )
    agent(sweep_obj["id"], count=2, function=lambda p: {"loss": 0.1 if p.get("lr") == 0.01 else 0.5})
    fetched = lumina_env.get_sweep(sweep_obj["id"])
    assert fetched["bestRunId"] is not None


def test_list_observations_returns_seeded_rows(lumina_env):
    sweep_obj = sweep(
        {
            "method": "random",
            "parameters": {"lr": {"values": [0.01]}},
            "metric": {"name": "loss", "goal": "minimize"},
        },
        project="demo",
        name="obs",
    )
    lumina_env.seed_sweep_runs(
        sweep_obj["id"],
        [
            {"runId": "r1", "params": {"lr": 0.01}, "metric": 0.1, "status": "finished"},
            {"runId": "r2", "params": {"lr": 0.01}, "metric": 0.2, "status": "finished"},
        ],
    )
    obs = list_observations(sweep_obj["id"])
    assert len(obs) == 2
    assert {o["runId"] for o in obs} == {"r1", "r2"}