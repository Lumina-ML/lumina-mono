"""Minimal HTTP client for the Lumina backend API."""

import json
import os
from typing import Any, Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


class LuminaClientError(Exception):
    """Raised when a Lumina backend request fails."""


class LuminaClient:
    """A thin HTTP client that talks to the Lumina backend."""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or os.getenv("LUMINA_API_URL", "http://localhost:8000")).rstrip("/")

    def _request(
        self,
        method: str,
        path: str,
        data: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = Request(url, data=body, headers=headers, method=method)

        try:
            with urlopen(req, timeout=30) as resp:
                resp_body = resp.read().decode("utf-8")
                return json.loads(resp_body) if resp_body else {}
        except HTTPError as e:
            resp_body = e.read().decode("utf-8")
            raise LuminaClientError(f"HTTP {e.code}: {resp_body}") from e
        except URLError as e:
            raise LuminaClientError(f"Connection failed: {e.reason}") from e

    def create_run(
        self,
        project: str,
        name: Optional[str] = None,
        config: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"project": project}
        if name:
            payload["name"] = name
        if config:
            payload["config"] = config
        return self._request("POST", "/api/v1/runs", payload)

    def finish_run(self, run_id: str) -> dict[str, Any]:
        return self._request("PATCH", f"/api/v1/runs/{run_id}", {"status": "finished"})

    def log_metrics(self, run_id: str, metrics: dict[str, Any], step: Optional[int] = None) -> None:
        payload_metrics = []
        for key, value in metrics.items():
            if isinstance(value, (int, float)):
                payload_metrics.append({"key": key, "value": float(value), "step": step or 0})
        if not payload_metrics:
            return
        self._request("POST", f"/api/v1/runs/{run_id}/metrics", {"metrics": payload_metrics})
