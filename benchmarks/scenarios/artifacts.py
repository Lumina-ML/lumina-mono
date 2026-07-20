"""Artifact & Model Registry scenarios: AR-1 ~ AR-3, MR-1."""

from __future__ import annotations

import hashlib
import os
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from lumina.backend.client import LuminaClient

from _common import API_URL, Timer, check_server, ensure_auth
from .base import Scenario, ScenarioResult


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _rewrite_storage_url(url: str) -> str:
    """When running benchmarks from the host against docker compose,
    presigned URLs may point to the internal hostname ``minio``.
    Rewrite it to ``localhost`` so the host can reach MinIO.
    """
    parsed = urlparse(url)
    if parsed.hostname == "minio" and parsed.port == 9000:
        parts = list(parsed)
        # netloc = host:port
        parts[1] = "localhost:9000"
        return urlunparse(parts)
    return url


class ArtifactUploadDownloadScenario(Scenario):
    """AR-1: artifact upload, download, and digest verification."""

    scenario_id = "AR-1"
    name = "Artifact upload/download"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        params = self.params()
        size_mb = params["artifact_size_mb"]

        # Cap benchmark artifact size to keep CI reasonable.
        if size_mb > 500:
            return ScenarioResult(
                scenario_id=self.scenario_id,
                level=self.level,
                mode=self.mode,
                status="skipped",
                metrics={"artifact_size_mb": size_mb},
                error="Artifact size capped at 500 MB for this benchmark",
            )

        project = "benchmark-artifacts"
        client = LuminaClient()
        project_obj = client.get_project_by_name(project)
        if not project_obj:
            project_obj = client._request("POST", "/api/v1/projects", {"name": project})
        project_id = project_obj["id"]

        with tempfile.NamedTemporaryFile(delete=False) as f:
            # deterministic pseudo-random content
            data = os.urandom(1024 * 1024) * size_mb
            f.write(data)
            src_path = Path(f.name)

        original_digest = _sha256_file(src_path)
        artifact_name = f"bench-file-{int(time.time())}"

        try:
            with Timer() as t_upload:
                artifact = client.create_artifact(
                    project_id, artifact_name, "dataset", description=f"{size_mb} MB benchmark file"
                )
                version = client.create_artifact_version(
                    artifact["id"], "v0", aliases=["latest"]
                )
                file_meta = client.add_artifact_file(
                    version["id"],
                    src_path.name,
                    size=len(data),
                    sha256=original_digest,
                    content_type="application/octet-stream",
                )
                upload_url = file_meta.get("uploadUrl")
                if upload_url:
                    try:
                        client.upload_file_to_url(upload_url, data)
                    except Exception as exc:
                        # Local docker stacks often sign URLs with the internal
                        # object-storage hostname (e.g. "minio:9000") which the
                        # host cannot reach without being in the container network.
                        # Skip the scenario rather than fail ambiguously.
                        error_msg = str(exc)
                        if "minio" in upload_url or "SignatureDoesNotMatch" in error_msg:
                            return ScenarioResult(
                                scenario_id=self.scenario_id,
                                level=self.level,
                                mode=self.mode,
                                status="skipped",
                                metrics={"artifact_size_mb": size_mb},
                                error=(
                                    "Artifact storage endpoint is not reachable from the benchmark host "
                                    f"(presigned URL: {upload_url}). Run benchmarks inside the Docker network "
                                    "or configure a public S3 endpoint."
                                ),
                            )
                        raise
                client.finalize_artifact_version(version["id"])

            version_detail = client.get_artifact_version(version["id"])
            upload_digest = version_detail.get("digest")

            with tempfile.TemporaryDirectory() as tmp:
                with Timer() as t_download:
                    detail = client.get_artifact_version(version["id"])
                    files = detail.get("files", [])
                    downloaded: list[Path] = []
                    for file_meta in files:
                        download_url = file_meta.get("downloadUrl")
                        if not download_url:
                            continue
                        download_url = _rewrite_storage_url(download_url)
                        file_data = client.download_file_from_url(download_url)
                        dest = Path(tmp) / file_meta["path"]
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        dest.write_bytes(file_data)
                        downloaded.append(dest)

                download_digest = _sha256_file(downloaded[0]) if downloaded else None

            elapsed_upload = max(t_upload.elapsed, 1e-9)
            elapsed_download = max(t_download.elapsed, 1e-9)
            bytes_count = len(data)

            return ScenarioResult(
                scenario_id=self.scenario_id,
                level=self.level,
                mode=self.mode,
                status="passed" if download_digest == original_digest else "failed",
                metrics={
                    "artifact_size_mb": size_mb,
                    "bytes": bytes_count,
                    "upload_sec": round(elapsed_upload, 3),
                    "download_sec": round(elapsed_download, 3),
                    "upload_MBps": round((bytes_count / 1024 / 1024) / elapsed_upload, 2),
                    "download_MBps": round((bytes_count / 1024 / 1024) / elapsed_download, 2),
                },
                assertions={
                    "digest_match": download_digest == original_digest,
                    "has_version_digest": bool(upload_digest),
                    "downloaded_count": len(downloaded) == 1,
                },
            )
        finally:
            src_path.unlink(missing_ok=True)
