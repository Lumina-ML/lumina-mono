"""`lumina demo` — one-shot wrappers around the bundled example scripts.

Implements Roadmap §MVP-2 / M1-4: instead of asking a new user to
``cd examples && python basic_experiment.py``, the CLI exposes the
five demo scenarios as proper subcommands. Each subcommand forwards to
the existing ``examples/*.py`` module's ``main()`` so the scripts
remain the source of truth and we never fork their behaviour.

Usage::

    lumina demo basic
    lumina demo sweep
    lumina demo evaluation
    lumina demo trace
    lumina demo artifacts
    lumina demo --reset             # purge the __demo__ project
    lumina demo --list              # print available scenarios

The subcommand is wired into the parent ``lumina`` CLI in
``cli.py`` via a single ``from . import demo as _demo`` so the
WandB-derived file stays untouched (Roadmap: "prefer extending
``lumina/backend/`` modules over touching WandB-derived code").
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import Iterable

import click

# Each scenario points at an ``examples/<name>_experiment.py`` module.
# The mapping is also reused by the help text, so keep the labels tight.
EXAMPLES_DIR = Path(__file__).resolve().parents[4] / "examples"


def _scenarios() -> dict[str, str]:
    """Return ``{scenario: example_module_name}``.

    Computed lazily so we can importlib.import_module after the user
    cd's into the repo, and so a typo in this file surfaces as an
    ImportError at CLI invocation rather than at import time.
    """
    return {
        "basic": "basic_experiment",
        "sweep": "sweep_experiment",
        "evaluation": "evaluation_experiment",
        "trace": "trace_experiment",
        "artifacts": "artifact_experiment",
    }


def _resolve_examples_path() -> str:
    """Push ``examples/`` onto sys.path so ``import basic_experiment``
    works regardless of where the user invoked the CLI from.

    Falls back silently if the examples directory has been moved (e.g.
    when the package is installed from a wheel). The user then gets a
    clear ImportError rather than a confusing path error.
    """
    if not EXAMPLES_DIR.is_dir():
        raise click.ClickException(
            f"Could not locate the examples directory at {EXAMPLES_DIR}. "
            "This command must be run from a Lumina source checkout."
        )
    p = str(EXAMPLES_DIR)
    if p not in sys.path:
        sys.path.insert(0, p)
    return p


def _run_example(scenario: str) -> None:
    scenarios = _scenarios()
    if scenario not in scenarios:
        raise click.ClickException(
            f"Unknown demo scenario: {scenario!r}. "
            f"Available: {', '.join(sorted(scenarios))}. "
            "Run `lumina demo --list` for the full list."
        )
    _resolve_examples_path()
    module = importlib.import_module(scenarios[scenario])
    if not hasattr(module, "main"):
        raise click.ClickException(
            f"Example module {scenarios[scenario]!r} has no main() — "
            "cannot run it as a demo."
        )
    click.echo(f"▶ Running demo: {scenario} ({scenarios[scenario]}.py)")
    module.main()
    click.echo("✓ Done. Open the dashboard to see the new data.")


def _reset_demo() -> None:
    """Hit the server's sandbox/reset-demo endpoint."""
    import os

    import lumina  # local import — heavy at top-level

    api_url = os.environ.get("LUMINA_API_URL", "http://localhost:8000")
    api_key = os.environ.get("LUMINA_API_KEY")
    if not api_key:
        raise click.ClickException(
            "LUMINA_API_KEY is not set; cannot reset demo data on the server. "
            "Either export it or run the reset from the dashboard UI."
        )

    import urllib.request
    import json

    # Find the demo project by name first so we can call the reset
    # endpoint with the right id.
    list_url = f"{api_url.rstrip('/')}/api/v1/projects?limit=100"
    req = urllib.request.Request(list_url, headers={"Authorization": f"Bearer {api_key}"})
    with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310
        body = json.loads(resp.read())
    demo = next((p for p in body.get("items", []) if p.get("name") == "__demo__"), None)
    if not demo:
        raise click.ClickException(
            "No __demo__ project found on the server. "
            "Has the bootstrap seed run?"
        )

    reset_url = f"{api_url.rstrip('/')}/api/v1/sandbox/reset-demo"
    req = urllib.request.Request(
        reset_url,
        data=json.dumps({"projectId": demo["id"]}).encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
        result = json.loads(resp.read())
    deleted = result.get("deleted", {})
    click.echo(
        "✓ Demo data reset "
        f"({deleted.get('runs', 0)} runs, {deleted.get('artifacts', 0)} artifacts cleared)."
    )


@click.command(
    name="demo",
    context_settings={"help_option_names": ["-h", "--help"]},
    short_help="Run a bundled demo scenario against the active Lumina backend.",
    help=(
        "One-shot wrapper around the bundled examples/*.py scripts so you can "
        "populate the __demo__ project without cd'ing into the examples dir. "
        "Forwarded scenarios match the dashboard's 'Try it' cards: "
        "basic / sweep / evaluation / trace / artifacts."
    ),
)
@click.argument("scenario", required=False)
@click.option(
    "--list",
    "list_only",
    is_flag=True,
    help="Print the available demo scenarios and exit.",
)
@click.option(
    "--reset",
    "reset",
    is_flag=True,
    help="Wipe everything in the server's __demo__ project.",
)
def demo(scenario: str | None, list_only: bool, reset: bool) -> None:
    if list_only:
        scenarios = _scenarios()
        click.echo("Available demo scenarios:")
        for name, module in scenarios.items():
            click.echo(f"  {name:<12} → examples/{module}.py")
        return

    if reset:
        _reset_demo()
        return

    if not scenario:
        click.echo(
            "Missing scenario name. Pass one of: "
            f"{', '.join(sorted(_scenarios()))}.\n"
            "Run `lumina demo --list` for the full list."
        )
        raise click.UsageError("scenario argument required")

    _run_example(scenario)