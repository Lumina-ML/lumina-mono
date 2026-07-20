"""Stub for the wandb-cloud ``watch`` / ``unwatch`` model-logging hooks.

Step 3.7 — the original ``_watch`` / ``_unwatch`` hooked into the
torch ``nn.Module`` forward / backward passes and streamed per-step
gradient / parameter histograms to wandb-cloud via the wandb-core
mailbox. Under the Lumina backend there is no equivalent (the
``LuminaRun`` class doesn't expose ``watch`` / ``unwatch`` yet — see
the ``Run`` vs ``LuminaRun`` capability gap tracked in
``Issues/Wandb-Internal-Refactor-Issues.md``).

This stub keeps the import surface working
(``from lumina.sdk.wandb_watch import _watch, _unwatch`` resolves)
but the calls are no-ops.
"""
from __future__ import annotations
import warnings
from typing import Any


def _watch(run: Any, models: Any, criterion: Any = None, log: Any = "gradients",
           log_freq: int = 1000, idx: int | None = None, log_graph: bool = False) -> None:
    """No-op stub. ``Run.watch`` is not implemented under the Lumina backend."""
    warnings.warn(
        "lumina.sdk.wandb_watch._watch() is a no-op under the "
        "Lumina backend. Per-step gradient / parameter logging is "
        "not yet implemented for LuminaRun.",
        DeprecationWarning,
        stacklevel=2,
    )


def _unwatch(run: Any, models: Any = None) -> None:
    """No-op stub. ``Run.unwatch`` is not implemented under the Lumina backend."""
    warnings.warn(
        "lumina.sdk.wandb_watch._unwatch() is a no-op under the "
        "Lumina backend.",
        DeprecationWarning,
        stacklevel=2,
    )
