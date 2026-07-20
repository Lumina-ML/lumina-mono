"""Media & Table scenarios: MD-1 ~ MD-2."""

from __future__ import annotations

import io
import struct
import tempfile
import time
import zlib
from pathlib import Path

from lumina import LuminaTable
from lumina.backend.client import LuminaClient

from _common import Timer, check_server, ensure_auth
from .artifacts import _resolve_project, _s3_skip_result
from .base import Scenario, ScenarioResult


def _tiny_png() -> bytes:
    """Return a minimal 1x1 red PNG without external deps."""
    width, height = 1, 1
    raw = bytes([255, 0, 0])  # RGB
    compressed = zlib.compress(raw)

    def chunk(type_name: bytes, data: bytes) -> bytes:
        chunk_len = struct.pack(">I", len(data))
        chunk_crc = struct.pack(">I", zlib.crc32(type_name + data) & 0xFFFFFFFF)
        return chunk_len + type_name + data + chunk_crc

    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr = chunk(b"IHDR", ihdr_data)
    idat = chunk(b"IDAT", compressed)
    iend = chunk(b"IEND", b"")
    signature = b"\x89PNG\r\n\x1a\n"
    return signature + ihdr + idat + iend


class ImageMediaScenario(Scenario):
    """MD-1: log an image via run-media and verify it is queryable."""

    scenario_id = "MD-1"
    name = "Image media logging"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-media"
        client = LuminaClient()
        project_id = _resolve_project(client, project)

        png_data = _tiny_png()
        key = "benchmark-image"

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(png_data)
            img_path = Path(f.name)

        try:
            with Timer() as t:
                artifact = client.create_artifact(
                    project_id, f"run-media-{int(time.time())}", "file"
                )
                version = client.create_artifact_version(
                    artifact["id"], "v0", aliases=["latest"]
                )
                sha = __import__("hashlib").sha256(png_data).hexdigest()
                file_meta = client.add_artifact_file(
                    version["id"],
                    "image.png",
                    size=len(png_data),
                    sha256=sha,
                    content_type="image/png",
                )
                upload_url = file_meta.get("uploadUrl")
                if upload_url:
                    try:
                        client.upload_file_to_url(upload_url, png_data)
                    except Exception:
                        if "minio" in upload_url:
                            return _s3_skip_result(
                                self.scenario_id, self.level, self.mode, upload_url
                            )
                        raise
                client.finalize_artifact_version(version["id"])

                media = client.create_run_media(
                    project_id,
                    key,
                    "image",
                    version["id"],
                    metadata={"benchmark": True},
                )

            items = client.list_run_media(project_id, type="image").get("items", [])
            found = any(item.get("id") == media.get("id") for item in items)

            return ScenarioResult(
                scenario_id=self.scenario_id,
                level=self.level,
                mode=self.mode,
                status="passed" if found else "failed",
                metrics={
                    "media_id": media.get("id"),
                    "bytes": len(png_data),
                    "elapsed_ms": round(t.elapsed * 1000, 2),
                },
                assertions={
                    "media_created": bool(media.get("id")),
                    "media_listed": found,
                },
            )
        finally:
            img_path.unlink(missing_ok=True)


class TableMediaScenario(Scenario):
    """MD-2: log a LuminaTable and verify it is queryable."""

    scenario_id = "MD-2"
    name = "Table media logging"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-media"
        client = LuminaClient()
        project_id = _resolve_project(client, project)

        table = LuminaTable(columns=["epoch", "loss", "acc"])
        for epoch in range(5):
            table.add_row([epoch, 1.0 / (epoch + 1), epoch * 0.2])

        csv_bytes = table.to_csv().encode("utf-8")
        key = "benchmark-table"

        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(csv_bytes)
            csv_path = Path(f.name)

        try:
            with Timer() as t:
                artifact = client.create_artifact(
                    project_id, f"table-media-{int(time.time())}", "file"
                )
                version = client.create_artifact_version(
                    artifact["id"], "v0", aliases=["latest"]
                )
                sha = __import__("hashlib").sha256(csv_bytes).hexdigest()
                file_meta = client.add_artifact_file(
                    version["id"],
                    "table.csv",
                    size=len(csv_bytes),
                    sha256=sha,
                    content_type="text/csv",
                )
                upload_url = file_meta.get("uploadUrl")
                if upload_url:
                    try:
                        client.upload_file_to_url(upload_url, csv_bytes)
                    except Exception:
                        if "minio" in upload_url:
                            return _s3_skip_result(
                                self.scenario_id, self.level, self.mode, upload_url
                            )
                        raise
                client.finalize_artifact_version(version["id"])

                media = client.create_run_media(
                    project_id,
                    key,
                    "table",
                    version["id"],
                    metadata={"benchmark": True},
                )

            items = client.list_run_media(project_id, type="table").get("items", [])
            found = any(item.get("id") == media.get("id") for item in items)

            return ScenarioResult(
                scenario_id=self.scenario_id,
                level=self.level,
                mode=self.mode,
                status="passed" if found else "failed",
                metrics={
                    "media_id": media.get("id"),
                    "rows": len(table.data),
                    "elapsed_ms": round(t.elapsed * 1000, 2),
                },
                assertions={
                    "media_created": bool(media.get("id")),
                    "media_listed": found,
                    "row_count": len(table.data) == 5,
                },
            )
        finally:
            csv_path.unlink(missing_ok=True)
