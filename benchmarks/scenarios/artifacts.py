"""Artifact & Model Registry scenarios: AR-1 ~ AR-3, MR-1."""

from __future__ import annotations

import hashlib
import os
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from lumina import LuminaArtifact, artifact_lineage, link_artifacts
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
        parts[1] = "localhost:9000"
        return urlunparse(parts)
    return url


def _s3_skip_result(scenario_id: str, level: str, mode: str, upload_url: str) -> ScenarioResult:
    return ScenarioResult(
        scenario_id=scenario_id,
        level=level,
        mode=mode,
        status="skipped",
        metrics={},
        error=(
            "Artifact storage endpoint is not reachable from the benchmark host "
            f"(presigned URL: {upload_url}). Run benchmarks inside the Docker network "
            "or configure a public S3 endpoint."
        ),
    )


def _resolve_project(client: LuminaClient, name: str) -> str:
    project = client.get_project_by_name(name)
    if not project:
        project = client._request("POST", "/api/v1/projects", {"name": name})
    return project["id"]


class ArtifactUploadDownloadScenario(Scenario):
    """AR-1: artifact upload, download, and digest verification."""

    scenario_id = "AR-1"
    name = "Artifact upload/download"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        params = self.params()
        size_mb = params["artifact_size_mb"]

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
        project_id = _resolve_project(client, project)

        with tempfile.NamedTemporaryFile(delete=False) as f:
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
                    except Exception:
                        if "minio" in upload_url:
                            return _s3_skip_result(
                                self.scenario_id, self.level, self.mode, upload_url
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


class ManySmallFilesArtifactScenario(Scenario):
    """AR-2: artifact with many small files."""

    scenario_id = "AR-2"
    name = "Many small files artifact"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        params = self.params()
        file_count = min(params["files_per_artifact"], 1000)

        project = "benchmark-artifacts"
        client = LuminaClient()
        project_id = _resolve_project(client, project)

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for i in range(file_count):
                (root / f"file_{i:04d}.txt").write_text(f"content-{i}")

            artifact_name = f"bench-many-files-{int(time.time())}"
            with Timer() as t:
                artifact = client.create_artifact(
                    project_id, artifact_name, "dataset", description=f"{file_count} files"
                )
                version = client.create_artifact_version(
                    artifact["id"], "v0", aliases=["latest"]
                )
                for path in sorted(root.rglob("*")):
                    if not path.is_file():
                        continue
                    data = path.read_bytes()
                    sha = hashlib.sha256(data).hexdigest()
                    file_meta = client.add_artifact_file(
                        version["id"],
                        path.relative_to(root).as_posix(),
                        size=len(data),
                        sha256=sha,
                    )
                    upload_url = file_meta.get("uploadUrl")
                    if upload_url:
                        try:
                            client.upload_file_to_url(upload_url, data)
                        except Exception:
                            if "minio" in upload_url:
                                return _s3_skip_result(
                                    self.scenario_id, self.level, self.mode, upload_url
                                )
                            raise
                client.finalize_artifact_version(version["id"])

            detail = client.get_artifact_version(version["id"])
            manifest_files = detail.get("files", [])

            return ScenarioResult(
                scenario_id=self.scenario_id,
                level=self.level,
                mode=self.mode,
                status="passed" if len(manifest_files) == file_count else "failed",
                metrics={
                    "file_count": file_count,
                    "elapsed_sec": round(t.elapsed, 3),
                    "files/sec": round(file_count / max(t.elapsed, 1e-9), 1),
                },
                assertions={
                    "manifest_count_match": len(manifest_files) == file_count,
                    "has_digest": bool(detail.get("digest")),
                },
            )


class ArtifactLineageScenario(Scenario):
    """AR-3: artifact lineage between parent and child versions."""

    scenario_id = "AR-3"
    name = "Artifact lineage"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-artifacts"
        client = LuminaClient()
        project_id = _resolve_project(client, project)

        ts = int(time.time())
        parent_name = f"bench-parent-{ts}"
        child_name = f"bench-child-{ts}"

        # Use reference files so this scenario doesn't depend on object storage.
        parent_art = LuminaArtifact(parent_name, type="dataset")
        parent_art.add_reference("s3://datasets/parent.parquet", "parent.parquet", size=1024)
        parent_saved = parent_art.save(project=project, version="v0", aliases=["latest"])
        parent_version_id = parent_saved["version"]["id"]

        child_art = LuminaArtifact(child_name, type="model")
        child_art.add_reference("s3://models/child.pt", "child.pt", size=2048)
        child_saved = child_art.save(project=project, version="v0", aliases=["latest"])
        child_version_id = child_saved["version"]["id"]

        link_artifacts(child_version_id, parent_version_id, lineage_type="derived_from")

        lineage = artifact_lineage(child_version_id)
        parents = lineage.get("parents", [])
        # The server returns { type, version: { id, artifactId, ... } }
        parent_version_ids = {p.get("version", {}).get("id") for p in parents}

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if parent_version_id in parent_version_ids else "failed",
            metrics={
                "parent_version_id": parent_version_id,
                "child_version_id": child_version_id,
            },
            assertions={
                "parent_linked": parent_version_id in parent_version_ids,
                "lineage_non_empty": len(parents) > 0,
            },
        )


class ModelRegistryScenario(Scenario):
    """MR-1: log a model to the registry and retrieve it by alias."""

    scenario_id = "MR-1"
    name = "Model registry log/use"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        params = self.params()
        size_mb = params["artifact_size_mb"]

        if size_mb > 500:
            return ScenarioResult(
                scenario_id=self.scenario_id,
                level=self.level,
                mode=self.mode,
                status="skipped",
                metrics={"artifact_size_mb": size_mb},
                error="Artifact size capped at 500 MB for this benchmark",
            )

        project = "benchmark-models"
        client = LuminaClient()
        project_id = _resolve_project(client, project)

        with tempfile.NamedTemporaryFile(delete=False) as f:
            data = os.urandom(1024 * 1024) * size_mb
            f.write(data)
            src_path = Path(f.name)

        original_digest = _sha256_file(src_path)
        model_name = f"bench-model-{int(time.time())}"

        try:
            with Timer() as t:
                artifact = client.create_artifact(
                    project_id, model_name, "model", description=f"{size_mb} MB benchmark model"
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
                    except Exception:
                        if "minio" in upload_url:
                            return _s3_skip_result(
                                self.scenario_id, self.level, self.mode, upload_url
                            )
                        raise
                client.finalize_artifact_version(version["id"])

                model = client.create_registry_model(project_id, model_name)
                registry_version = client.create_registry_model_version(
                    model["id"],
                    version["id"],
                    aliases=["latest"],
                    metadata={"benchmark": True},
                )

            version_detail = client.get_registry_model_version(registry_version["id"])
            artifact_version = version_detail.get("artifactVersion", {})
            files = artifact_version.get("files", [])

            with tempfile.TemporaryDirectory() as tmp:
                downloaded: list[Path] = []
                for file_meta in files:
                    download_url = file_meta.get("downloadUrl")
                    if not download_url:
                        continue
                    download_url = _rewrite_storage_url(download_url)
                    file_data = client.download_file_from_url(download_url)
                    dest = Path(tmp) / file_meta["path"]
                    dest.write_bytes(file_data)
                    downloaded.append(dest)

                download_digest = _sha256_file(downloaded[0]) if downloaded else None

            return ScenarioResult(
                scenario_id=self.scenario_id,
                level=self.level,
                mode=self.mode,
                status="passed" if download_digest == original_digest else "failed",
                metrics={
                    "model_name": model_name,
                    "artifact_size_mb": size_mb,
                    "bytes": len(data),
                    "elapsed_sec": round(t.elapsed, 3),
                    "registry_version_id": registry_version["id"],
                },
                assertions={
                    "digest_match": download_digest == original_digest,
                    "registry_version_created": bool(registry_version.get("id")),
                    "files_downloaded": len(downloaded) == 1,
                },
            )
        finally:
            src_path.unlink(missing_ok=True)
