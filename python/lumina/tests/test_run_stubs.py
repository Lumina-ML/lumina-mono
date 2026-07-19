"""SDK tests for the previously-stubbed LuminaRun methods.

These tests exercise the SDK end-to-end against an in-process HTTP fake
(see fake_backend.py) so we verify real HTTP request shapes, base64
encoding/decoding, and the LuminaRun -> LuminaClient -> backend pipeline.
"""

import os
import tempfile
from typing import Any

import pytest

from lumina.backend.client import LuminaClient
from lumina.backend.run import LuminaRun


pytest_plugins = ["fake_backend"]


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _make_run(base_url: str, run_id: str = "test-run-id") -> LuminaRun:
    client = LuminaClient(base_url=base_url)
    return LuminaRun(
        run_id=run_id,
        project="demo",
        name="exp",
        config={"lr": 0.01},
        client=client,
    )


class TestSaveRestore:
    def test_save_uploads_matching_files(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        run = _make_run(url)

        with tempfile.TemporaryDirectory() as tmp:
            a = os.path.join(tmp, "a.txt")
            b = os.path.join(tmp, "sub", "b.txt")
            os.makedirs(os.path.dirname(b), exist_ok=True)
            with open(a, "w") as fh:
                fh.write("alpha")
            with open(b, "w") as fh:
                fh.write("bravo")

            uploaded = run.save("*.txt", base_path=tmp)

        assert sorted(uploaded) == ["a.txt", os.path.join("sub", "b.txt")]
        files = backend.get_run_files(run._run_id)
        assert files["a.txt"] == b"alpha"
        assert files[os.path.join("sub", "b.txt")] == b"bravo"

    def test_save_no_glob_matches_returns_empty(self, fake_backend: Any) -> None:
        url, _ = fake_backend
        run = _make_run(url)
        with tempfile.TemporaryDirectory() as tmp:
            uploaded = run.save("*.does-not-exist", base_path=tmp)
        assert uploaded == []

    def test_restore_downloads_to_disk(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        run = _make_run(url, run_id="run-A")

        # Seed a file directly via the client
        run._client.save_run_file("run-A", "ckpt.bin", b"binary-bytes")

        with tempfile.TemporaryDirectory() as tmp:
            buf = run.restore("ckpt.bin", root=tmp)
            assert buf is not None
            assert buf.read() == b"binary-bytes"
            on_disk = os.path.join(tmp, "ckpt.bin")
            assert os.path.exists(on_disk)
            with open(on_disk, "rb") as fh:
                assert fh.read() == b"binary-bytes"

    def test_restore_returns_none_when_file_missing(self, fake_backend: Any) -> None:
        url, _ = fake_backend
        run = _make_run(url)
        with tempfile.TemporaryDirectory() as tmp:
            buf = run.restore("missing.bin", root=tmp)
        assert buf is None


class TestMarkPreemptingAndPin:
    def test_mark_preempting_patches_status(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        run = _make_run(url, run_id="run-pre")

        run.mark_preempting()
        assert backend.get_run("run-pre")["status"] == "preempting"

    def test_pin_config_keys_persists_in_metadata(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        run = _make_run(url, run_id="run-pin")

        run.pin_config_keys("lr", "batch_size")
        metadata = backend.get_run("run-pin")["metadata"]
        assert metadata["pinnedConfigKeys"] == ["lr", "batch_size"]