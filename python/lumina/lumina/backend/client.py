"""Minimal HTTP client for the Lumina backend API."""

import json
import os
from typing import Any, Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


class LuminaClientError(Exception):
    """Raised when a Lumina backend request fails."""


_API_KEY: Optional[str] = None


def set_api_key(api_key: Optional[str]) -> None:
    """Set the global API key used by all LuminaClient instances."""
    global _API_KEY
    _API_KEY = api_key


def get_api_key() -> Optional[str]:
    return _API_KEY or os.getenv("LUMINA_API_KEY")


class LuminaClient:
    """A thin HTTP client that talks to the Lumina backend."""

    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = (base_url or os.getenv("LUMINA_API_URL", "http://localhost:8000")).rstrip("/")
        self.api_key = api_key or get_api_key()

    def _request(
        self,
        method: str,
        path: str,
        data: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if data is not None:
            headers["Content-Type"] = "application/json"
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

    def update_run(
        self,
        run_id: str,
        *,
        config: dict[str, Any] | None = None,
        summary: dict[str, Any] | None = None,
        notes: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if config is not None:
            payload["config"] = config
        if summary is not None:
            payload["summary"] = summary
        if notes is not None:
            payload["notes"] = notes
        if metadata is not None:
            payload["metadata"] = metadata
        return self._request("PATCH", f"/api/v1/runs/{run_id}", payload)

    def log_metrics(self, run_id: str, metrics: dict[str, Any], step: Optional[int] = None) -> None:
        payload_metrics = []
        for key, value in metrics.items():
            if isinstance(value, (int, float)):
                f = float(value)
                # Skip non-finite values; they break JSON serialization.
                if f != f or f == float("inf") or f == float("-inf"):
                    continue
                payload_metrics.append({"key": key, "value": f, "step": step or 0})
        if not payload_metrics:
            return
        self._request("POST", f"/api/v1/runs/{run_id}/metrics", {"metrics": payload_metrics})

    def list_metrics(
        self,
        run_id: str,
        keys: Optional[list[str]] = None,
        limit: int = 10000,
    ) -> dict[str, Any]:
        query_parts: list[str] = [f"limit={limit}"]
        if keys:
            query_parts.append("keys=" + ",".join(keys))
        query = "&".join(query_parts)
        return self._request("GET", f"/api/v1/runs/{run_id}/metrics?{query}")

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

    def mark_preempting(self, run_id: str) -> dict[str, Any]:
        return self._request("PATCH", f"/api/v1/runs/{run_id}", {"status": "preempting"})

    def pin_config_keys(self, run_id: str, keys: list[str]) -> dict[str, Any]:
        return self._request(
            "PATCH",
            f"/api/v1/runs/{run_id}",
            {"metadata": {"pinnedConfigKeys": list(keys)}},
        )

    def save_run_file(
        self,
        run_id: str,
        path: str,
        content: bytes,
        policy: str = "live",
    ) -> dict[str, Any]:
        """Upload a file to a run's object storage. Backed by the
        `POST /api/v1/runs/{runId}/files` endpoint."""
        import base64

        payload = {
            "path": path,
            "contentBase64": base64.b64encode(content).decode("ascii"),
            "policy": policy,
        }
        return self._request("POST", f"/api/v1/runs/{run_id}/files", payload)

    def list_run_files(self, run_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/runs/{run_id}/files")

    def restore_run_file(self, run_id: str, path: str) -> bytes:
        """Download a previously saved file from a run. Backed by the
        `GET /api/v1/runs/{runId}/file?path=...` endpoint."""
        import base64

        result = self._request("GET", f"/api/v1/runs/{run_id}/file?path={path}")
        return base64.b64decode(result["contentBase64"])

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

    def add_artifact_file(
        self,
        version_id: str,
        path: str,
        size: int,
        sha256: Optional[str] = None,
        content_type: Optional[str] = None,
        reference_uri: Optional[str] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"path": path, "size": size}
        if sha256:
            payload["sha256"] = sha256
        if content_type:
            payload["contentType"] = content_type
        if reference_uri:
            payload["referenceUri"] = reference_uri
        return self._request(
            "POST",
            f"/api/v1/versions/{version_id}/files",
            payload,
        )

    def get_artifact_version(self, version_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/versions/{version_id}")

    def finalize_artifact_version(self, version_id: str) -> dict[str, Any]:
        """Trigger server-side manifest build + event emission."""
        return self._request("POST", f"/api/v1/versions/{version_id}/finalize", {})

    def attach_artifact_lineage(
        self,
        child_version_id: str,
        parent_version_id: str,
        lineage_type: str = "derived_from",
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/versions/{child_version_id}/lineage",
            {"parentVersionId": parent_version_id, "type": lineage_type},
        )

    def detach_artifact_lineage(self, child_version_id: str, parent_version_id: str) -> None:
        self._request(
            "DELETE",
            f"/api/v1/versions/{child_version_id}/lineage/{parent_version_id}",
        )

    def list_artifact_lineage(self, version_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/versions/{version_id}/lineage")

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

    def create_report(
        self,
        project_id: str,
        title: str,
        blocks: Optional[list[dict[str, Any]]] = None,
        created_by: Optional[str] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"title": title}
        if blocks:
            payload["blocks"] = blocks
        if created_by:
            payload["createdBy"] = created_by
        return self._request("POST", f"/api/v1/projects/{project_id}/reports", payload)

    def list_reports(self, project_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/projects/{project_id}/reports")

    def get_report(self, report_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/reports/{report_id}")

    def patch_report(
        self,
        report_id: str,
        title: Optional[str] = None,
        blocks: Optional[list[dict[str, Any]]] = None,
        created_by: Optional[str] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if title:
            payload["title"] = title
        if blocks:
            payload["blocks"] = blocks
        if created_by:
            payload["createdBy"] = created_by
        return self._request("PATCH", f"/api/v1/reports/{report_id}", payload)

    def delete_report(self, report_id: str) -> dict[str, Any]:
        return self._request("DELETE", f"/api/v1/reports/{report_id}")

    def create_run_media(
        self,
        project_id: str,
        key: str,
        type: str,
        artifact_version_id: str,
        run_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "key": key,
            "type": type,
            "artifactVersionId": artifact_version_id,
        }
        if run_id:
            payload["runId"] = run_id
        if metadata:
            payload["metadata"] = metadata
        return self._request("POST", f"/api/v1/projects/{project_id}/run-media", payload)

    def list_run_media(
        self,
        project_id: str,
        run_id: Optional[str] = None,
        type: Optional[str] = None,
    ) -> dict[str, Any]:
        params: dict[str, str] = {}
        if run_id:
            params["runId"] = run_id
        if type:
            params["type"] = type
        query = "&".join(f"{k}={v}" for k, v in params.items())
        path = f"/api/v1/projects/{project_id}/run-media"
        if query:
            path += f"?{query}"
        return self._request("GET", path)

    def get_run_media(self, run_media_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/run-media/{run_media_id}")

    def create_user(
        self,
        email: str,
        name: Optional[str] = None,
        avatar: Optional[str] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"email": email}
        if name:
            payload["name"] = name
        if avatar:
            payload["avatar"] = avatar
        return self._request("POST", "/api/v1/users", payload)

    def list_users(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/users")

    def get_user(self, user_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/users/{user_id}")

    def get_current_user(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/users/me")

    def update_user(self, user_id: str, name: Optional[str] = None, avatar: Optional[str] = None) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if name:
            payload["name"] = name
        if avatar:
            payload["avatar"] = avatar
        return self._request("PATCH", f"/api/v1/users/{user_id}", payload)

    def delete_user(self, user_id: str) -> dict[str, Any]:
        return self._request("DELETE", f"/api/v1/users/{user_id}")

    def generate_api_key(self, user_id: str) -> dict[str, Any]:
        return self._request("POST", f"/api/v1/users/{user_id}/api-key")

    def create_workspace_membership(
        self,
        workspace_id: str,
        user_id: str,
        role: str = "member",
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/api/v1/workspace-memberships",
            {"workspaceId": workspace_id, "userId": user_id, "role": role},
        )

    def list_workspace_memberships(self, workspace_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/workspaces/{workspace_id}/memberships")

    def list_user_memberships(self, user_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/users/{user_id}/memberships")

    def update_workspace_membership(self, membership_id: str, role: str) -> dict[str, Any]:
        return self._request("PATCH", f"/api/v1/workspace-memberships/{membership_id}", {"role": role})

    def delete_workspace_membership(self, membership_id: str) -> dict[str, Any]:
        return self._request("DELETE", f"/api/v1/workspace-memberships/{membership_id}")

    def create_launch_queue(
        self,
        project_id: str,
        name: str,
        config: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"name": name}
        if config:
            payload["config"] = config
        return self._request("POST", f"/api/v1/projects/{project_id}/launch-queues", payload)

    def list_launch_queues(self, project_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/projects/{project_id}/launch-queues")

    def get_launch_queue(self, queue_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/launch-queues/{queue_id}")

    def create_launch_job(
        self,
        project_id: str,
        name: str,
        image: Optional[str] = None,
        command: Optional[list[str]] = None,
        args: Optional[list[str]] = None,
        env: Optional[dict[str, str]] = None,
        config: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"name": name}
        if image:
            payload["image"] = image
        if command:
            payload["command"] = command
        if args:
            payload["args"] = args
        if env:
            payload["env"] = env
        if config:
            payload["config"] = config
        return self._request("POST", f"/api/v1/projects/{project_id}/launch-jobs", payload)

    def list_launch_jobs(self, project_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/projects/{project_id}/launch-jobs")

    def get_launch_job(self, job_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/launch-jobs/{job_id}")

    def create_launch_run(
        self,
        project_id: str,
        queue_id: str,
        job_id: str,
        run_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"queueId": queue_id, "jobId": job_id}
        if run_id:
            payload["runId"] = run_id
        if metadata:
            payload["metadata"] = metadata
        return self._request("POST", f"/api/v1/projects/{project_id}/launch-runs", payload)

    def list_launch_queue_runs(self, queue_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/launch-queues/{queue_id}/runs")

    def get_launch_run(self, run_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/launch-runs/{run_id}")

    def patch_launch_run(
        self,
        run_id: str,
        status: Optional[str] = None,
        run_id_field: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if status:
            payload["status"] = status
        if run_id_field:
            payload["runId"] = run_id_field
        if metadata:
            payload["metadata"] = metadata
        return self._request("PATCH", f"/api/v1/launch-runs/{run_id}", payload)

    def dequeue_launch_run(self, queue_id: str) -> dict[str, Any]:
        return self._request("POST", f"/api/v1/launch-queues/{queue_id}/dequeue")

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
