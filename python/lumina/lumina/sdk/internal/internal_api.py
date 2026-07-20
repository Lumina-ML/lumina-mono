"""Stub for the wandb-cloud GraphQL `Api` client.

Step 3.5 — all 1564 lines of the wandb-cloud `Api` class (GraphQL
mutations / queries against `api.wandb.ai`) were removed. Lumina's
reporting path goes through `LuminaClient` (REST) instead.

This stub preserves the import surface so legacy code that does
`from lumina.sdk.internal.internal_api import Api` or
`from lumina.apis import InternalApi` still resolves. Methods that
are no longer meaningful on the Lumina backend raise
`NotImplementedError` with a precise pointer; safe read-only
helpers (`settings`, `api_url`, …) return benign defaults.
"""
from __future__ import annotations
import logging
from typing import Any

logger = logging.getLogger(__name__)


class Api:
    """No-op stand-in for the wandb-cloud GraphQL `Api`.

    Kept so existing `from lumina.sdk.internal.internal_api import Api`
    imports keep working. The constructor accepts the same kwargs as
    the original (so `InternalApi(reset=True)` style calls in the CLI
    don't `TypeError`), but every method that would have hit the
    wandb cloud now raises `NotImplementedError`.
    """

    def __init__(
        self,
        default_settings: Any = None,
        load_settings: bool = True,
        retry_timedelta: Any = None,
        environ: Any = None,
        retry_callback: Any = None,
        api_key: str | None = None,
        **_extra: Any,
    ) -> None:
        self._settings = default_settings or {}
        self._api_key = api_key
        logger.debug(
            "Api stub initialized (Lumina backend). "
            "All wandb-cloud GraphQL methods are unavailable.",
        )

    # ----- read-only helpers (return safe defaults) -----
    def settings(self) -> dict[str, Any]:
        """Return the settings dict the Api was constructed with."""
        return self._settings

    @property
    def api_url(self) -> str | None:
        return None

    @property
    def app_url(self) -> str | None:
        return None

    # ----- everything else: clear NotImplementedError -----
    def __getattr__(self, name: str) -> Any:
        # Anything not explicitly defined above raises. Lets legacy
        # attribute reads blow up loudly instead of returning `None`
        # silently and confusing downstream logic.
        raise NotImplementedError(
            f"lumina.sdk.internal.internal_api.Api.{name} is unavailable "
            f"under the Lumina backend. Use LuminaClient instead "
            f"(lumina.backend.client.LuminaClient).",
        )
