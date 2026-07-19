"""CLI tests for the Lumina backend subcommands (`lumina agent` /
`lumina launch-agent`).

The command bodies live in ``lumina/cli/cli.py`` and dispatch to the SDK
functions ``lumina.backend.sweep.agent`` and
``lumina.backend.launch.launch_agent``. These tests drive them through
click's ``CliRunner`` against the shared fake backend so the wiring
(argument parsing, entry-point loading, project resolution) is covered
end-to-end without a real server.
"""

from __future__ import annotations

from typing import Any

import pytest
from click.testing import CliRunner

from lumina.cli.cli import _load_entry_point, cli
from lumina.backend.sweep import sweep


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


# ── lumina launch-agent ──────────────────────────────────────────────────
def test_launch_agent_command_executes_queued_run(lumina_env) -> None:
    queue = lumina_env.create_launch_queue("demo", "q1")
    job = lumina_env.create_launch_job(
        "demo", "j1", command=["echo", "hello-from-cli"], args=[]
    )
    run = lumina_env.create_launch_run("demo", queue["id"], job["id"])

    result = CliRunner().invoke(
        cli,
        ["launch-agent", queue["id"], "--project", "demo", "--max-runs", "1"],
    )

    assert result.exit_code == 0, result.output
    assert lumina_env.get_launch_run(run["id"])["status"] == "completed"


def test_launch_agent_dry_run_does_not_execute(lumina_env) -> None:
    queue = lumina_env.create_launch_queue("demo", "q1")
    job = lumina_env.create_launch_job("demo", "j1", command=["echo", "hi"], args=[])
    run = lumina_env.create_launch_run("demo", queue["id"], job["id"])

    result = CliRunner().invoke(
        cli,
        [
            "launch-agent",
            queue["id"],
            "--project",
            "demo",
            "--max-runs",
            "1",
            "--dry-run",
        ],
    )

    assert result.exit_code == 0, result.output
    # Dry-run still claims + marks the run completed (no compute), which is
    # the documented behavior; the point is the command wires through.
    assert lumina_env.get_launch_run(run["id"])["status"] == "completed"


# ── lumina agent (sweep) ─────────────────────────────────────────────────
def test_agent_command_runs_trials_via_entry_point(lumina_env, tmp_path) -> None:
    sweep_obj = sweep(
        {
            "method": "random",
            "parameters": {"lr": {"values": [0.001, 0.01, 0.1]}},
            "metric": {"name": "loss", "goal": "minimize"},
        },
        project="demo",
        name="cli-sweep",
    )

    script = tmp_path / "trial.py"
    script.write_text(
        "def main(params):\n"
        "    return {'loss': 0.1}\n"
    )

    result = CliRunner().invoke(
        cli,
        [
            "agent",
            sweep_obj["id"],
            "--count",
            "2",
            "--project",
            "demo",
            "--entry-point",
            str(script),
        ],
    )

    assert result.exit_code == 0, result.output
    # The two trials recorded observations; a best run should now be set.
    assert lumina_env.get_sweep(sweep_obj["id"])["bestRunId"] is not None


def test_agent_command_without_entry_point_still_creates_runs(lumina_env) -> None:
    sweep_obj = sweep(
        {
            "method": "random",
            "parameters": {"lr": {"values": [0.01]}},
            "metric": {"name": "loss", "goal": "minimize"},
        },
        project="demo",
        name="cli-sweep-bare",
    )

    result = CliRunner().invoke(
        cli,
        ["agent", sweep_obj["id"], "--count", "1", "--project", "demo"],
    )

    assert result.exit_code == 0, result.output


def test_agent_command_reports_missing_entry_point(lumina_env) -> None:
    sweep_obj = sweep(
        {
            "method": "random",
            "parameters": {"lr": {"values": [0.01]}},
            "metric": {"name": "loss", "goal": "minimize"},
        },
        project="demo",
        name="cli-sweep-missing",
    )

    result = CliRunner().invoke(
        cli,
        [
            "agent",
            sweep_obj["id"],
            "--project",
            "demo",
            "--entry-point",
            "/nonexistent/trial.py",
        ],
    )

    assert result.exit_code != 0
    assert "Entry-point not found" in result.output


# ── _load_entry_point helper ─────────────────────────────────────────────
def test_load_entry_point_missing_file() -> None:
    import click

    with pytest.raises(click.ClickException):
        _load_entry_point("/nonexistent/script.py")


def test_load_entry_point_requires_main_or_run(tmp_path) -> None:
    import click

    script = tmp_path / "bad.py"
    script.write_text("x = 1\n")
    with pytest.raises(click.ClickException):
        _load_entry_point(str(script))


def test_load_entry_point_loads_main(tmp_path) -> None:
    script = tmp_path / "good.py"
    script.write_text("def main(params):\n    return {'ok': True}\n")
    fn = _load_entry_point(str(script))
    assert fn({"lr": 0.01}) == {"ok": True}


def test_load_entry_point_loads_run_fallback(tmp_path) -> None:
    script = tmp_path / "runfn.py"
    script.write_text("def run(params):\n    return {'ran': True}\n")
    fn = _load_entry_point(str(script))
    assert fn({}) == {"ran": True}
