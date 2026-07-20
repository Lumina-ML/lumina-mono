"""Stub for the wandb-cloud `Summary` dict-like class.

Step 3.7 — the original `Summary` dispatched `SummaryRecord`
updates through the wandb-core service binary's mailbox via the
``_update_callback``. The Lumina backend stores summary server-side
and reads it back from the ``Run.summary`` mapping (which is the
live ``LuminaRun.summary``).

This stub keeps the import surface working:
``from lumina.sdk.wandb_summary import Summary`` resolves, but the
returned class is a thin dict-like wrapper that stores values in
process-local state and prints a one-shot deprecation warning
when ``.update()`` is called (suggesting ``Run.summary[key] = v``
on ``LuminaRun`` instead).
"""
from __future__ import annotations
import warnings
from typing import Any


class SummaryDict:
    """No-op dict-like stub. Stores writes in a local dict."""

    def __init__(self, _get_current_summary_callback: Any = None) -> None:
        object.__setattr__(self, "_data", {})

    def keys(self) -> list[str]:
        return list(self._data.keys())

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def __getitem__(self, key: str) -> Any:
        return self._data[key]

    def __setitem__(self, key: str, val: Any) -> None:
        warnings.warn(
            "lumina.sdk.wandb_summary.Summary is a stub under the "
            "Lumina backend. Use LuminaRun.summary[key] = value "
            "to update summary server-side.",
            DeprecationWarning,
            stacklevel=2,
        )
        self._data[key] = val

    def __delitem__(self, key: str) -> None:
        del self._data[key]

    def __contains__(self, key: str) -> bool:
        return key in self._data

    def update(self, d: dict) -> None:
        for key, value in d.items():
            self[key] = value

    def _as_dict(self) -> dict[str, Any]:
        return dict(self._data)

    def _update(self, record: Any) -> None:
        # Used to push a SummaryRecord into the wandb-core mailbox.
        # No equivalent on the Lumina backend — silently drop.
        warnings.warn(
            "lumina.sdk.wandb_summary._update() is a no-op under the "
            "Lumina backend.",
            DeprecationWarning,
            stacklevel=2,
        )


class Summary(SummaryDict):
    """Stub for ``wandb.summary``.

    Use ``LuminaRun.summary[key] = value`` on the live LuminaRun
    instance instead — that path goes through
    ``LuminaClient.update_run(summary=...)`` and persists to the
    Lumina server.
    """


class SummarySubDict(SummaryDict):
    """Stub for the non-root summary dict.
    Stores writes in process-local state.
    """
