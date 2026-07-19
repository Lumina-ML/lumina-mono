"""Artifact tests covering dedup, manifest, lineage, and reference support."""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

import lumina
from lumina.backend.artifact import (
    LuminaArtifact,
    artifact_lineage,
    link_artifacts,
    unlink_artifacts,
)


pytest_plugins = ["fake_backend"]


@pytest.fixture
def lumina_env(monkeypatch: pytest.MonkeyPatch, fake_backend: tuple[str, object]):
    base_url, backend = fake_backend
    monkeypatch.setenv("LUMINA_API_URL", base_url)
    monkeypatch.setenv("LUMINA_API_KEY", "test-key")
    yield backend


def _save_with(art: LuminaArtifact, project: str = "demo") -> dict:
    return art.save(project=project)


def test_save_uploads_sha256_and_finalizes_manifest(lumina_env, tmp_path: Path):
    (tmp_path / "weights.bin").write_bytes(b"hello world")
    art = LuminaArtifact(name="model", type="model")
    art.add_file(tmp_path / "weights.bin")
    result = _save_with(art)

    files = lumina_env.get_artifact_files(result["version"]["id"])
    assert len(files) == 1
    assert files[0]["sha256"] == hashlib.sha256(b"hello world").hexdigest()
    assert files[0]["path"] == "weights.bin"

    digest = lumina_env.get_version_digest(result["version"]["id"])
    assert isinstance(digest, str) and len(digest) == 64


def test_add_dir_preserves_relative_paths(lumina_env, tmp_path: Path):
    nested = tmp_path / "sub" / "deeper"
    nested.mkdir(parents=True)
    (nested / "file.txt").write_text("ok")

    art = LuminaArtifact(name="dataset")
    art.add_dir(tmp_path / "sub")
    result = _save_with(art)

    paths = [f["path"] for f in lumina_env.get_artifact_files(result["version"]["id"])]
    assert paths == ["deeper/file.txt"]


def test_add_reference_does_not_upload(lumina_env):
    art = LuminaArtifact(name="weights-ref", type="model")
    art.add_reference("s3://other-bucket/path/weights.bin", "weights.bin", size=4096)
    result = _save_with(art)

    files = lumina_env.get_artifact_files(result["version"]["id"])
    assert len(files) == 1
    assert files[0]["referenceUri"] == "s3://other-bucket/path/weights.bin"
    assert files[0]["path"] == "weights.bin"
    assert files[0]["size"] == 4096


def test_link_and_unlink_artifacts(lumina_env):
    a = LuminaArtifact(name="a").add_reference("s3://b", "f")
    a.save(project="demo")
    b = LuminaArtifact(name="b").add_reference("s3://c", "g")
    b.save(project="demo")

    parent_id = a._saved_version_id  # type: ignore[attr-defined]
    child_id = b._saved_version_id  # type: ignore[attr-defined]

    link_artifacts(child_id, parent_id, lineage_type="used")
    edges = lumina_env.get_lineage_edges()
    assert any(e["child"] == child_id and e["parent"] == parent_id for e in edges)

    lineage = artifact_lineage(child_id)
    assert len(lineage["parents"]) == 1
    assert lineage["parents"][0]["type"] == "used"

    unlink_artifacts(child_id, parent_id)
    assert not any(
        e["child"] == child_id and e["parent"] == parent_id
        for e in lumina_env.get_lineage_edges()
    )