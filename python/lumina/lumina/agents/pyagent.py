"""Stub for the wandb-cloud `pyagent` sweep-agent entry point.

Step 3.7 — the original 350-line `pyagent` was the long-running
sweep-agent process that polled wandb-cloud for new sweep jobs
via the deleted GraphQL stack. Under the Lumina backend, sweep
suggestion runs over REST (`LuminaClient` + server-side
``/api/v1/sweeps/:id/suggest``), so the agent loop has no work
to do here.

Kept as a callable module so ``from lumina.agents import pyagent``
keeps resolving. Functions that the legacy agent exposed now raise
``NotImplementedError`` pointing at the new REST path.
"""
from __future__ import annotations
from typing import Any


def agent(*args: Any, **kwargs: Any) -> Any:
    """Stub for ``wandb agent`` (CLI subcommand)."""
    raise NotImplementedError(
        "lumina.agents.pyagent.agent() is unavailable under the "
        "Lumina backend. Sweep agents should poll "
        "GET /api/v1/sweeps/:id/suggest on the Lumina server.",
    )


def _terminate_thread(*args: Any, **kwargs: Any) -> None:
    """No-op stub (kept so legacy imports resolve)."""
    return None
