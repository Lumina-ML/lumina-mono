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

    def log_system_metrics(self, run_id: str, metrics: dict[str, Any], step: Optional[int] = None) -> None:
        payload_metrics = []
        for key, value in metrics.items():
            if isinstance(value, (int, float)):
                payload_metrics.append({"key": key, "value": float(value), "step": step or 0})
        if not payload_metrics:
            return
        self._request("POST", f"/api/v1/runs/{run_id}/system-metrics", {"metrics": payload_metrics})

    def log_lines(self, run_id: str, lines: list[dict[str, Any]]) -> None:
        payload = []
        for line in lines:
            item: dict[str, Any] = {"level": line.get("level", "INFO"), "message": line["message"]}
            if line.get("step") is not None:
                item["step"] = line["step"]
            payload.append(item)
        self._request("POST", f"/api/v1/runs/{run_id}/logs", {"logs": payload})

    def add_tag(self, run_id: str, name: str, color: Optional[str] = None) -> None:
        payload: dict[str, Any] = {"name": name}
        if color:
            payload["color"] = color
        self._request("POST", f"/api/v1/runs/{run_id}/tags", payload)

    def list_projects(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/projects")

    def get_project_by_name(self, name: str) -> Optional[dict[str, Any]]:
        result = self.list_projects()
        for project in result.get("items", []):
            if project.get("name") == name:
                return project
        return None

    def create_artifact(
        self,
        project_id: str,
        name: str,
        type: str = "file",
        description: Optional[str] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"name": name, "type": type}
        if description:
            payload["description"] = description
        return self._request("POST", f"/api/v1/projects/{project_id}/artifacts", payload)

    def get_artifact(self, artifact_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/artifacts/{artifact_id}")

    def create_artifact_version(
        self,
        artifact_id: str,
        version: str,
        aliases: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"version": version}
        if aliases:
            payload["aliases"] = aliases
        if metadata:
            payload["metadata"] = metadata
        return self._request("POST", f"/api/v1/artifacts/{artifact_id}/versions", payload)

    def add_artifact_file(self, version_id: str, path: str, size: int) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/versions/{version_id}/files",
            {"path": path, "size": size},
        )

    def get_artifact_version(self, version_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/versions/{version_id}")

    def patch_artifact_version(
        self,
        version_id: str,
        state: Optional[str] = None,
        aliases: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if state:
            payload["state"] = state
        if aliases:
            payload["aliases"] = aliases
        if metadata:
            payload["metadata"] = metadata
        return self._request("PATCH", f"/api/v1/versions/{version_id}", payload)

    def upload_file_to_url(self, url: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        req = Request(url, data=data, headers={"Content-Type": content_type}, method="PUT")
        try:
            with urlopen(req, timeout=60) as resp:
                resp.read()
        except HTTPError as e:
            resp_body = e.read().decode("utf-8")
            raise LuminaClientError(f"HTTP {e.code}: {resp_body}") from e
        except URLError as e:
            raise LuminaClientError(f"Connection failed: {e.reason}") from e

    def download_file_from_url(self, url: str) -> bytes:
        req = Request(url, method="GET")
        try:
            with urlopen(req, timeout=60) as resp:
                return resp.read()
        except HTTPError as e:
            resp_body = e.read().decode("utf-8")
            raise LuminaClientError(f"HTTP {e.code}: {resp_body}") from e
        except URLError as e:
            raise LuminaClientError(f"Connection failed: {e.reason}") from e
