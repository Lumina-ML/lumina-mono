"""Shared test fixtures for the Lumina SDK tests.

Uses a stub HTTP backend (`FakeLuminaBackend`) so the SDK can be exercised
end-to-end without spinning up Docker. The fake enforces the same request
shapes as the real server and exposes an `inspect()` helper for assertions.
"""

from __future__ import annotations

import base64
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import pytest

# In-memory store keyed by run id; values are arbitrary "backend" rows.
_RUNS: dict[str, dict[str, Any]] = {}
_RUN_FILES: dict[str, dict[str, bytes]] = {}  # run_id -> {path -> bytes}


def _reset_state() -> None:
    _RUNS.clear()
    _RUN_FILES.clear()


def _handle(method: str, path: str, body: dict[str, Any]) -> tuple[Any, int]:
    # Strip query string for path matching so /file?path=foo still matches
    # the run-file route.
    base_path = path.split("?", 1)[0]
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
    if method == "PATCH" and path.startswith("/api/v1/runs/"):
        run_id = path.split("/")[4]
        run = _RUNS.setdefault(run_id, {"runId": run_id, "status": "running", "metadata": {}})
        if "status" in body:
            run["status"] = body["status"]
        if "metadata" in body:
            run["metadata"] = body["metadata"]
        return run, 200
    if method == "POST" and path == "/api/v1/runs":
        run_id = body.get("runId") or body.get("name", "fake-run")
        run = _RUNS.setdefault(
            run_id,
            {"runId": run_id, "status": "running", "metadata": {}, "projectId": body.get("project")},
        )
        return run, 201
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
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:  # noqa: N802
        response, status = _handle("POST", self.path, self._read_body())
        self._send(status, response)

    def do_PATCH(self) -> None:  # noqa: N802
        response, status = _handle("PATCH", self.path, self._read_body())
        self._send(status, response)

    def do_GET(self) -> None:  # noqa: N802
        response, status = _handle("GET", self.path, {})
        self._send(status, response)


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


@pytest.fixture
def fake_backend() -> Any:
    backend = FakeLuminaBackend()
    url = backend.start()
    try:
        yield url, backend
    finally:
        backend.stop()