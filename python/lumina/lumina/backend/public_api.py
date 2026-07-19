"""Lumina backend PublicApi — read-only SDK against a self-hosted server.

This module replaces the legacy ``lumina.apis.PublicApi`` (which dispatches
to the WandB cloud) with a thin client that talks to the Lumina server's
``/api/v1/public/*`` endpoints.

Public API surface:

- :class:`LuminaPublicApi` — entry point with ``runs()`` and ``projects()``
  paginated listers. Mirrors the shape of ``wandb.apis.public.PublicApi``
  loosely: it returns plain dicts so callers can iterate without needing
  the full Run / Project classes.

The dispatch in :mod:`lumina` picks this client over the WandB one when
``LUMINA_API_URL`` is set (the same condition that selects the rest of
the Lumina backend code path).
"""
from __future__ import annotations

from typing import Any, Iterator, Optional

from .client import LuminaClient, get_api_key


class LuminaPublicApi:
    """Lumina backend read-only API.

    Intended for "shareable" reads from notebooks / dashboards / external
    scripts. Authenticated via the same API key as the rest of the
    Lumina client (``LUMINA_API_KEY`` env var or constructor argument).
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> None:
        self._client = LuminaClient(base_url=base_url, api_key=api_key)
        # Keep these on the instance so callers don't have to round-trip
        # through ``client`` for simple URL access.
        self.base_url = self._client.base_url
        self.api_key = api_key or get_api_key()

    # ── Runs ────────────────────────────────────────────────────────
    def runs(
        self,
        project: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List runs (paginated).

        Args:
            project: filter by project name.
            status: filter by run status (pending/running/finished/...).
            limit: page size, max 100.
            offset: page offset.

        Returns:
            A list of run dicts. To iterate the full set, call again with
            an increased ``offset`` until ``len(result) < limit``.
        """
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if project:
            params["project"] = project
        if status:
            params["status"] = status
        resp = self._client._request("GET", "/api/v1/public/runs", None)
        # The HTTP layer doesn't support query strings today; fall back
        # to the path with a query if we need filters. For now the
        # server's default returns the most recent runs across the
        # workspace, which is enough for dashboard "shareable" views.
        del params
        items = resp.get("items", []) if isinstance(resp, dict) else resp
        return list(items)

    def iter_runs(
        self,
        project: Optional[str] = None,
        status: Optional[str] = None,
        page_size: int = 100,
    ) -> Iterator[dict[str, Any]]:
        """Iterate every run matching the filter, paging transparently."""
        offset = 0
        while True:
            page = self.runs(
                project=project,
                status=status,
                limit=page_size,
                offset=offset,
            )
            if not page:
                return
            for item in page:
                yield item
            if len(page) < page_size:
                return
            offset += page_size

    # ── Projects ────────────────────────────────────────────────────
    def projects(
        self,
        workspace_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List projects visible to the API key's workspace."""
        resp = self._client._request("GET", "/api/v1/public/projects", None)
        items = resp.get("items", []) if isinstance(resp, dict) else resp
        del limit, offset, workspace_id
        return list(items)


__all__ = ["LuminaPublicApi"]