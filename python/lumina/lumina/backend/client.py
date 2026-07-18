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
        sweep_id: Optional[str] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"project": project}
        if name:
            payload["name"] = name
        if sweep_id:
            payload["sweepId"] = sweep_id
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

    def create_registry_model(
        self,
        project_id: str,
        name: str,
        description: Optional[str] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"name": name}
        if description:
            payload["description"] = description
        return self._request("POST", f"/api/v1/projects/{project_id}/registry-models", payload)

    def list_registry_models(self, project_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/projects/{project_id}/registry-models")

    def get_registry_model(self, model_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/registry-models/{model_id}")

    def create_registry_model_version(
        self,
        model_id: str,
        artifact_version_id: str,
        version: Optional[str] = None,
        aliases: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"artifactVersionId": artifact_version_id}
        if version:
            payload["version"] = version
        if aliases:
            payload["aliases"] = aliases
        if metadata:
            payload["metadata"] = metadata
        return self._request("POST", f"/api/v1/registry-models/{model_id}/versions", payload)

    def list_registry_model_versions(self, model_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/registry-models/{model_id}/versions")

    def get_registry_model_version(self, version_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/registry-model-versions/{version_id}")

    def patch_registry_model_version(
        self,
        version_id: str,
        aliases: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if aliases:
            payload["aliases"] = aliases
        if metadata:
            payload["metadata"] = metadata
        return self._request("PATCH", f"/api/v1/registry-model-versions/{version_id}", payload)

    def create_evaluation(
        self,
        project_id: str,
        name: str,
        run_id: Optional[str] = None,
        dataset_artifact_version_id: Optional[str] = None,
        model_artifact_version_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"name": name}
        if run_id:
            payload["runId"] = run_id
        if dataset_artifact_version_id:
            payload["datasetArtifactVersionId"] = dataset_artifact_version_id
        if model_artifact_version_id:
            payload["modelArtifactVersionId"] = model_artifact_version_id
        if metadata:
            payload["metadata"] = metadata
        return self._request("POST", f"/api/v1/projects/{project_id}/evaluations", payload)

    def list_evaluations(self, project_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/projects/{project_id}/evaluations")

    def get_evaluation(self, evaluation_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/evaluations/{evaluation_id}")

    def patch_evaluation(
        self,
        evaluation_id: str,
        status: Optional[str] = None,
        summary: Optional[dict[str, Any]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if status:
            payload["status"] = status
        if summary:
            payload["summary"] = summary
        if metadata:
            payload["metadata"] = metadata
        return self._request("PATCH", f"/api/v1/evaluations/{evaluation_id}", payload)

    def add_evaluation_result(
        self,
        evaluation_id: str,
        key: str,
        value: float,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"key": key, "value": value}
        if metadata:
            payload["metadata"] = metadata
        return self._request("POST", f"/api/v1/evaluations/{evaluation_id}/results", payload)

    def create_trace(
        self,
        project_id: str,
        name: str,
        trace_id: Optional[str] = None,
        run_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"name": name}
        if trace_id:
            payload["traceId"] = trace_id
        if run_id:
            payload["runId"] = run_id
        if metadata:
            payload["metadata"] = metadata
        return self._request("POST", f"/api/v1/projects/{project_id}/traces", payload)

    def list_traces(self, project_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/projects/{project_id}/traces")

    def get_trace(self, trace_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/traces/{trace_id}")

    def patch_trace(
        self,
        trace_id: str,
        status: Optional[str] = None,
        latency_ms: Optional[int] = None,
        metadata: Optional[dict[str, Any]] = None,
        finished_at: Optional[str] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if status:
            payload["status"] = status
        if latency_ms is not None:
            payload["latencyMs"] = latency_ms
        if metadata:
            payload["metadata"] = metadata
        if finished_at:
            payload["finishedAt"] = finished_at
        return self._request("PATCH", f"/api/v1/traces/{trace_id}", payload)

    def create_span(
        self,
        trace_id: str,
        name: str,
        span_id: Optional[str] = None,
        parent_span_id: Optional[str] = None,
        kind: str = "internal",
        input_data: Optional[dict[str, Any]] = None,
        output_data: Optional[dict[str, Any]] = None,
        latency_ms: Optional[int] = None,
        status: str = "ok",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"name": name, "kind": kind, "status": status}
        if span_id:
            payload["spanId"] = span_id
        if parent_span_id:
            payload["parentSpanId"] = parent_span_id
        if input_data:
            payload["input"] = input_data
        if output_data:
            payload["output"] = output_data
        if latency_ms is not None:
            payload["latencyMs"] = latency_ms
        return self._request("POST", f"/api/v1/traces/{trace_id}/spans", payload)

    def get_span(self, span_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/spans/{span_id}")

    def patch_span(
        self,
        span_id: str,
        status: Optional[str] = None,
        output_data: Optional[dict[str, Any]] = None,
        latency_ms: Optional[int] = None,
        finished_at: Optional[str] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if status:
            payload["status"] = status
        if output_data:
            payload["output"] = output_data
        if latency_ms is not None:
            payload["latencyMs"] = latency_ms
        if finished_at:
            payload["finishedAt"] = finished_at
        return self._request("PATCH", f"/api/v1/spans/{span_id}", payload)

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
