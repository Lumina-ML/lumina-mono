"""Stub for the wandb-cloud `wandb.init()` entry point.

Step 3.7 — the 992-line implementation that booted the wandb-core
service process and dispatched Records through the wandb-cloud
GraphQL / FileStream / FilePusher stack was deleted.

The Lumina SDK uses ``lumina.init()`` instead (cut over in step 3.1,
see ``lumina/__init__.py:init()``). For users who still
``from lumina.sdk.wandb_init import init`` (because they pinned the
old name) we forward to the new Lumina entry point at call time
(via lazy import to avoid the circular dependency this stub
introduces with ``lumina/__init__.py``).

``_attach`` is a wandb-core-specific operation (attach to an
existing wandb process) that has no Lumina equivalent; it now
emits a ``DeprecationWarning`` and returns ``None``.
"""
from __future__ import annotations
import warnings
from typing import Any


def init(*args: Any, **kwargs: Any) -> Any:
    """Deprecated alias for ``lumina.init()``.

    Step 3.1 — ``lumina.init()`` is the canonical entry point.
    This shim is kept so existing imports don't fail. Behavior
    matches ``lumina.init()`` exactly.

    Note: ``lumina`` is imported lazily inside the function to avoid
    the circular dependency this module would introduce if it
    imported ``lumina`` at module load time (the canonical
    ``lumina/__init__.py`` imports this module via
    ``lumina.sdk.wandb_init`` re-export).
    """
    import lumina as _lumina
    return _lumina.init(*args, **kwargs)


def _attach(attach_id: str | None = None, run_id: str | None = None, *, run: Any = None) -> None:
    """Stub for the wandb-cloud ``_attach`` (service-process attach).

    The Lumina backend has no service process — runs are accessed
    directly via ``LuminaRun``. Returns ``None`` and emits a
    deprecation warning.
    """
    warnings.warn(
        "lumina.sdk.wandb_init._attach() is unsupported under the "
        "Lumina backend; load a saved run via the PublicApi instead.",
        DeprecationWarning,
        stacklevel=2,
    )
    return None

