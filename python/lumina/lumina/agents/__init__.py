"""Stub for the wandb-cloud sweep / launch agent machinery.

Step 3.7 — the original `lumina/agents/` package held the
sweep-agent (`pyagent.py`) and the launch-run-queue agent
(`agent.py` / `run.py` / `job.py`), which together implemented
`wandb agent` and `wandb launch-agent` against the wandb-cloud
GraphQL stack.

Under the Lumina backend:
- Sweep agents go through `LuminaClient` + the new `lumina.backend
  .sweep` module (see step 3.2 phase A.4 — server-side
  `/api/v1/sweeps/:id/suggest`).
- Launch agents are not yet implemented (the `apps/server/src/modules
  /launch` module exposes the REST endpoints, but the client-side
  long-running agent loop is a future PR).

This stub keeps the `from lumina.agents import pyagent` imports
that `sdk/lib/run_stopping.py` and `wandb_agent.py` (top-level
shim) still need, but routes every operation to a no-op so the
sweep / launch code paths fail loud at the actual call site
rather than crashing on a stale import.
"""
from __future__ import annotations
from lumina.agents import pyagent  # noqa: F401  (re-export)

__all__ = ("pyagent",)
