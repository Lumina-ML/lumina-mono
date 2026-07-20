"""Stub for the wandb-cloud `Run` class.

Step 3.7 — the 2901-line wandb-cloud `Run` (which dispatched
metrics/summary/events through the wandb-core service binary +
FileStream / FilePusher) was deleted.

The Lumina SDK uses ``LuminaRun`` instead (see
``lumina.backend.run.LuminaRun``). This stub re-exports
``LuminaRun`` as ``Run`` so existing
``from lumina.sdk.wandb_run import Run`` imports keep working.
Methods that wandb-cloud `Run` exposed but `LuminaRun` doesn't
implement (or where the Lumina backend has no equivalent, e.g.
``restore``) emit a clear ``NotImplementedError`` at call time.
"""
from __future__ import annotations
from typing import Any

from lumina.backend.run import LuminaRun as Run  # noqa: F401

__all__ = ("Run", "restore", "finish", "TeardownStage", "TeardownHook", "RunStatus")


def restore(
    name: str,
    run_path: str | None = None,
    replace: bool = False,
    root: str | None = None,
) -> Any:
    """Stub for ``wandb.restore``.

    The wandb-cloud version of this pulled files down from a
    remote URL. Under the Lumina backend, file restore goes through
    ``LuminaClient.restore_run_file`` (see ``lumina.backend.client``).
    Raises so callers know to migrate.
    """
    raise NotImplementedError(
        "lumina.sdk.wandb_run.restore() is unavailable under the "
        "Lumina backend. Use LuminaClient.restore_run_file() instead.",
    )


def finish(exit_code: int | None = None, quiet: bool | None = None) -> None:
    """No-op finish shim — the Lumina backend auto-finalizes runs.

    Under the Lumina backend, ``lumina.run.finish()`` (or context-
    manager exit) handles run finalisation. This stub exists only
    so legacy imports ``from lumina.sdk.wandb_run import finish``
    resolve.
    """
    import lumina as _lumina
    _lumina.finish(exit_code=exit_code, quiet=quiet)


# Compat-only symbols — preserved so importers that referenced
# them via ``lumina.sdk.wandb_run.<name>`` keep resolving. The
# ``RunStatusChecker`` class is intentionally not provided (the
# lumina-side ``LuminaRun.status()`` returns ``RunStatus`` directly).
TeardownStage: Any = None
TeardownHook: Any = None
RunStatus: Any = None
