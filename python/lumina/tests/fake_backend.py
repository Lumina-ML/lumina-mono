"""Shared test fixtures for the Lumina SDK tests.

Uses a stub HTTP backend (`FakeLuminaBackend`) so the SDK can be exercised
end-to-end without spinning up Docker. The fake enforces the same request
shapes as the real server and exposes an `inspect()` helper for assertions.
"""

from __future__ import annotations

import base64
import hashlib
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import pytest

# In-memory store keyed by run id; values are arbitrary "backend" rows.
_RUNS: dict[str, dict[str, Any]] = {}
_RUN_FILES: dict[str, dict[str, bytes]] = {}  # run_id -> {path -> bytes}
_PROJECTS: dict[str, dict[str, Any]] = {}
_ARTIFACTS: dict[str, dict[str, Any]] = {}  # by id
_ARTIFACTS_BY_NAME: dict[tuple[str, str], str] = {}  # (projectId, name) -> id
_ARTIFACT_VERSIONS: dict[str, dict[str, Any]] = {}  # by version id
_ARTIFACT_FILES: dict[str, list[dict[str, Any]]] = {}  # version_id -> files
_LINEAGE: list[dict[str, Any]] = []  # {child, parent, type}
_VERSION_DIGESTS: dict[str, str] = {}
_UPLOADS: dict[str, int] = {}  # upload_url -> bytes received


def _reset_state() -> None:
    _RUNS.clear()
    _RUN_FILES.clear()
    _PROJECTS.clear()
    _ARTIFACTS.clear()
    _ARTIFACTS_BY_NAME.clear()
    _ARTIFACT_VERSIONS.clear()
    _ARTIFACT_FILES.clear()
    _LINEAGE.clear()
    _VERSION_DIGESTS.clear()
    _UPLOADS.clear()


def _project_id_for(name: str) -> str:
    for pid, p in _PROJECTS.items():
        if p["name"] == name:
            return pid
    pid = f"proj-{len(_PROJECTS) + 1}"
    _PROJECTS[pid] = {"id": pid, "name": name}
    return pid


def _artifact_id(project_id: str, name: str) -> str | None:
    return _ARTIFACTS_BY_NAME.get((project_id, name))


def _handle(method: str, path: str, body: dict[str, Any], *, upload_base: str = "") -> tuple[Any, int]:
    base_path = path.split("?", 1)[0]

    # Projects
    if method == "GET" and base_path == "/api/v1/projects":
        return {"items": list(_PROJECTS.values())}, 200
    if method == "POST" and base_path == "/api/v1/projects":
        pid = _project_id_for(body["name"])
        return _PROJECTS[pid], 201

    # Runs / run files (used by save/restore tests)
    if method == "POST" and base_path.startswith("/api/v1/runs/") and base_path.endswith("/files"):
        run_id = base_path.split("/")[4]
        run_files = _RUN_FILES.setdefault(run_id, {})
        run_files[body["path"]] = base64.b64decode(body["contentBase64"])
        return {
            "path": body["path"],
            "size": len(run_files[body["path"]]),
            "storedAt": "2024-01-01T00:00:00Z",
        }, 201
    if method == "GET" and base_path.startswith("/api/v1/runs/") and base_path.endswith("/file"):
        run_id = base_path.split("/")[4]
        query = path.split("?", 1)[1] if "?" in path else ""
        params = dict(p.split("=", 1) for p in query.split("&")) if query else {}
        file_path = params.get("path", "")
        run_files = _RUN_FILES.get(run_id, {})
        if file_path not in run_files:
            return {"error": "File not found"}, 404
        return {
            "runId": run_id,
            "path": file_path,
            "contentBase64": base64.b64encode(run_files[file_path]).decode("ascii"),
            "size": len(run_files[file_path]),
        }, 200
    if method == "PATCH" and base_path.startswith("/api/v1/runs/"):
        run_id = base_path.split("/")[4]
        run = _RUNS.setdefault(run_id, {"runId": run_id, "status": "running", "metadata": {}})
        if "status" in body:
            run["status"] = body["status"]
        if "metadata" in body:
            run["metadata"] = body["metadata"]
        return run, 200
    if method == "POST" and base_path == "/api/v1/runs":
        run_id = body.get("runId") or body.get("name", "fake-run")
        project = body.get("project")
        run = _RUNS.setdefault(
            run_id,
            {"runId": run_id, "status": "running", "metadata": {}, "projectId": _project_id_for(project) if project else None},
        )
        return run, 201

    # Artifact routes
    if method == "GET" and base_path.startswith("/api/v1/projects/") and base_path.endswith("/artifacts"):
        project_id = base_path.split("/")[4]
        items = [a for a in _ARTIFACTS.values() if a["projectId"] == project_id]
        return {"items": items}, 200
    if method == "POST" and base_path.startswith("/api/v1/projects/") and base_path.endswith("/artifacts"):
        project_id = base_path.split("/")[4]
        existing = _artifact_id(project_id, body["name"])
        if existing:
            return _ARTIFACTS[existing], 200
        aid = f"art-{len(_ARTIFACTS) + 1}"
        row = {
            "id": aid,
            "projectId": project_id,
            "name": body["name"],
            "type": body.get("type", "file"),
            "description": body.get("description"),
        }
        _ARTIFACTS[aid] = row
        _ARTIFACTS_BY_NAME[(project_id, body["name"])] = aid
        return row, 201
    if method == "POST" and "/versions" in base_path and base_path.startswith("/api/v1/artifacts/"):
        artifact_id = base_path.split("/")[4]
        vid = f"ver-{len(_ARTIFACT_VERSIONS) + 1}"
        vrow = {
            "id": vid,
            "artifactId": artifact_id,
            "version": body.get("version"),
            "aliases": body.get("aliases", []),
            "metadata": body.get("metadata", {}),
            "state": "pending",
        }
        _ARTIFACT_VERSIONS[vid] = vrow
        _ARTIFACT_FILES[vid] = []
        return vrow, 201
    if method == "POST" and "/files" in base_path and base_path.startswith("/api/v1/versions/"):
        version_id = base_path.split("/")[4]
        files = _ARTIFACT_FILES.setdefault(version_id, [])
        files.append(body)
        upload_url = f"{upload_base}/uploads/{version_id}/{len(files)}" if upload_base else None
        return {"file": body, "uploadUrl": upload_url}, 201
    if method == "POST" and base_path.startswith("/api/v1/versions/") and base_path.endswith("/finalize"):
        version_id = base_path.split("/")[4]
        files = _ARTIFACT_FILES.get(version_id, [])
        manifest = {
            "version": 1,
            "entries": sorted(
                [
                    {
                        "path": f["path"],
                        "digest": f.get("sha256") or f"etag:{f.get('referenceUri', f['path'])}",
                        "size": str(f.get("size", 0)),
                        **({"referenceUri": f["referenceUri"]} if f.get("referenceUri") else {}),
                    }
                    for f in files
                ],
                key=lambda e: e["path"],
            ),
        }
        canonical = json.dumps(manifest, separators=(",", ":"), sort_keys=True)
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        _VERSION_DIGESTS[version_id] = digest
        _ARTIFACT_VERSIONS[version_id]["state"] = "committed"
        _ARTIFACT_VERSIONS[version_id]["manifest"] = manifest
        _ARTIFACT_VERSIONS[version_id]["digest"] = digest
        return _ARTIFACT_VERSIONS[version_id], 200
    if method == "GET" and base_path.endswith("/lineage") and base_path.startswith("/api/v1/versions/"):
        child = base_path.split("/")[4]
        return {
            "parents": [{"type": l["type"], "version": {"id": l["parent"]}} for l in _LINEAGE if l["child"] == child],
            "children": [{"type": l["type"], "version": {"id": l["child"]}} for l in _LINEAGE if l["parent"] == child],
        }, 200
    if method == "GET" and base_path.startswith("/api/v1/versions/"):
        version_id = base_path.split("/")[4]
        if version_id not in _ARTIFACT_VERSIONS:
            return {"error": "not found"}, 404
        v = dict(_ARTIFACT_VERSIONS[version_id])
        v["files"] = _ARTIFACT_FILES.get(version_id, [])
        return v, 200
    if method == "PATCH" and base_path.startswith("/api/v1/versions/"):
        version_id = base_path.split("/")[4]
        if version_id not in _ARTIFACT_VERSIONS:
            return {"error": "not found"}, 404
        if "state" in body:
            _ARTIFACT_VERSIONS[version_id]["state"] = body["state"]
        return _ARTIFACT_VERSIONS[version_id], 200

    # Lineage
    if method == "POST" and base_path.endswith("/lineage") and base_path.startswith("/api/v1/versions/"):
        child = base_path.split("/")[4]
        existing = next((l for l in _LINEAGE if l["child"] == child and l["parent"] == body["parentVersionId"]), None)
        if existing:
            existing["type"] = body.get("type", existing["type"])
            return existing, 200
        edge = {"child": child, "parent": body["parentVersionId"], "type": body.get("type", "derived_from")}
        _LINEAGE.append(edge)
        return edge, 201
    if method == "DELETE" and "/lineage/" in base_path and base_path.startswith("/api/v1/versions/"):
        parts = base_path.split("/")
        child = parts[4]
        parent = parts[6]
        before = len(_LINEAGE)
        _LINEAGE[:] = [l for l in _LINEAGE if not (l["child"] == child and l["parent"] == parent)]
        return None, 204 if len(_LINEAGE) < before else 404

    return {"error": "not implemented", "path": path, "method": method}, 501


class _Handler(BaseHTTPRequestHandler):
    server_version = "FakeLuminaBackend/1.0"

    def log_message(self, *_args: Any) -> None:
        return

    def _read_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return {}

    def _send(self, status: int, payload: Any) -> None:
        if payload is None:
            self.send_response(status)
            self.end_headers()
            return
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    @property
    def _upload_base(self) -> str:
        host, port = self.server.server_address  # type: ignore[attr-defined]
        return f"http://{host}:{port}"

    def do_POST(self) -> None:  # noqa: N802
        response, status = _handle("POST", self.path, self._read_body(), upload_base=self._upload_base)
        self._send(status, response)

    def do_PATCH(self) -> None:  # noqa: N802
        response, status = _handle("PATCH", self.path, self._read_body())
        self._send(status, response)

    def do_GET(self) -> None:  # noqa: N802
        response, status = _handle("GET", self.path, {})
        self._send(status, response)

    def do_DELETE(self) -> None:  # noqa: N802
        response, status = _handle("DELETE", self.path, {})
        self._send(status, response)

    def do_PUT(self) -> None:  # noqa: N802
        # Accept presigned-PUT requests to the fake upload URL and store the body size.
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b""
        _UPLOADS[self.path] = len(body)
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.end_headers()


class FakeLuminaBackend:
    """Starts an HTTP server on a free port and exposes lifecycle helpers."""

    def __init__(self) -> None:
        self._server: HTTPServer | None = None
        self._thread: threading.Thread | None = None
        self.base_url: str = ""

    def start(self) -> str:
        _reset_state()
        self._server = HTTPServer(("127.0.0.1", 0), _Handler)
        self.base_url = f"http://127.0.0.1:{self._server.server_address[1]}"
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        return self.base_url

    def stop(self) -> None:
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
            self._server = None
        if self._thread is not None:
            self._thread.join(timeout=1.0)
            self._thread = None

    def get_run(self, run_id: str) -> dict[str, Any]:
        return _RUNS.get(run_id, {})

    def get_run_files(self, run_id: str) -> dict[str, bytes]:
        return dict(_RUN_FILES.get(run_id, {}))

    # Artifact test introspection
    def get_artifact_files(self, version_id: str) -> list[dict[str, Any]]:
        return list(_ARTIFACT_FILES.get(version_id, []))

    def get_version(self, version_id: str) -> dict[str, Any]:
        return dict(_ARTIFACT_VERSIONS.get(version_id, {}))

    def get_version_digest(self, version_id: str) -> str | None:
        return _VERSION_DIGESTS.get(version_id)

    def get_lineage_edges(self) -> list[dict[str, Any]]:
        return list(_LINEAGE)

    def get_upload_count(self, url: str) -> int | None:
        return _UPLOADS.get(url)


@pytest.fixture
def fake_backend() -> Any:
    backend = FakeLuminaBackend()
    url = backend.start()
    try:
        yield url, backend
    finally:
        backend.stop()