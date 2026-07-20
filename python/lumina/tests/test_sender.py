"""End-to-end tests for the rewired SendManager.

Exercises `SendManager.send(...)` against the in-process HTTP fake
backend so we verify proto → REST translation works end-to-end. Tests
build a fresh `SendManager` per scenario with a `LuminaClient` pointed
at `fake_backend`'s base_url.
"""

import json
import os
import queue
import tempfile
from typing import Any

import pytest

from lumina.backend.client import LuminaClient
from lumina.proto import wandb_internal_pb2
from lumina.sdk.interface.interface_queue import InterfaceQueue
from lumina.sdk.internal.sender import SendManager
from lumina.sdk.internal.settings_static import SettingsStatic


pytest_plugins = ["fake_backend"]


def _make_sm(base_url: str, files_dir: str, *, resume: Any = None) -> SendManager:
    """Construct a SendManager wired to the in-process fake backend."""
    settings = SettingsStatic({
        "x_files_dir": files_dir,
        "root_dir": os.path.dirname(files_dir),
        "resume": resume,
        "x_sync": True,
    })
    record_q: "queue.Queue[Any]" = queue.Queue()
    result_q: "queue.Queue[Any]" = queue.Queue()
    interface = InterfaceQueue(record_q=record_q)
    return SendManager(
        settings=settings,
        record_q=record_q,
        result_q=result_q,
        interface=interface,
        client=LuminaClient(base_url=base_url),
    )


def _make_run_pb(name: str = "r-1", project: str = "demo") -> Any:
    pb = wandb_internal_pb2.Record()
    pb.run.run_id = name
    pb.run.project = project
    pb.run.start_time.GetCurrentTime()
    pb.control.req_resp = True
    return pb


def _make_history_pb(metrics: dict, step: int) -> Any:
    pb = wandb_internal_pb2.Record()
    for k, v in metrics.items():
        item = pb.history.item.add()
        item.key = k
        item.value_json = json.dumps(v)
    step_item = pb.history.item.add()
    step_item.key = "_step"
    step_item.value_json = str(step)
    return pb


class TestRunInit:
    def test_create_run_via_lumina_client(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        with tempfile.TemporaryDirectory() as tmp:
            sm = _make_sm(url, os.path.join(tmp, "files"))
            sm.send_run(_make_run_pb("r-1"), file_dir=tmp)
        run = backend.get_run("r-1")
        assert run["runId"] == "r-1"
        assert run["status"] == "running"
        assert run["config"] == {}
        assert run["summary"] == {}

    def test_create_run_with_display_name_tags_group(
        self, fake_backend: Any,
    ) -> None:
        url, backend = fake_backend
        pb = _make_run_pb("r-2")
        pb.run.display_name = "My Run 2"
        pb.run.tags.extend(["alpha", "beta"])
        pb.run.run_group = "exp-group"
        pb.run.job_type = "train"
        pb.run.notes = "hello"
        with tempfile.TemporaryDirectory() as tmp:
            sm = _make_sm(url, os.path.join(tmp, "files"))
            sm.send_run(pb, file_dir=tmp)
        run = backend.get_run("r-2")
        assert run["displayName"] == "My Run 2"
        assert run["tags"] == ["alpha", "beta"]
        assert run["group"] == "exp-group"
        assert run["jobType"] == "train"
        assert run["notes"] == "hello"


class TestHistoryAndSummary:
    def test_history_routed_to_metrics(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        with tempfile.TemporaryDirectory() as tmp:
            sm = _make_sm(url, os.path.join(tmp, "files"))
            sm.send_run(_make_run_pb(), file_dir=tmp)
            sm.send(_make_history_pb({"loss": 0.5, "acc": 0.9}, step=1))
            sm.send(_make_history_pb({"loss": 0.4, "acc": 0.95}, step=2))
        rows = backend.get_run_metrics("r-1")
        # _step is filtered out by LuminaClient.log_metrics; verify loss+acc
        keys = {(r["key"], r["step"]) for r in rows}
        assert ("loss", 1) in keys
        assert ("loss", 2) in keys
        assert ("acc", 1) in keys

    def test_summary_pushed_via_patch(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        with tempfile.TemporaryDirectory() as tmp:
            sm = _make_sm(url, os.path.join(tmp, "files"))
            sm.send_run(_make_run_pb(), file_dir=tmp)
            pb = wandb_internal_pb2.Record()
            pb.summary.update.add(key="best_loss", value_json="0.123")
            sm.send(pb)
        run = backend.get_run("r-1")
        assert run["summary"]["best_loss"] == 0.123


class TestStatsAndOutput:
    def test_system_metrics_routed(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        with tempfile.TemporaryDirectory() as tmp:
            sm = _make_sm(url, os.path.join(tmp, "files"))
            sm.send_run(_make_run_pb(), file_dir=tmp)
            pb = wandb_internal_pb2.Record()
            pb.stats.timestamp.GetCurrentTime()
            pb.stats.stats_type = (
                wandb_internal_pb2.StatsRecord.StatsType.SYSTEM
            )
            item = pb.stats.item.add()
            item.key = "cpu"
            item.value_json = "0.42"
            sm.send(pb)
        sys_rows = backend.get_run_system_metrics("r-1")
        assert any(r.get("key") == "cpu" for r in sys_rows)

    def test_output_routed_to_log_lines(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        with tempfile.TemporaryDirectory() as tmp:
            sm = _make_sm(url, os.path.join(tmp, "files"))
            sm.send_run(_make_run_pb(), file_dir=tmp)
            pb = wandb_internal_pb2.Record()
            pb.output.line = "hello stdout\n"
            pb.output.output_type = (
                wandb_internal_pb2.OutputRecord.OutputType.STDOUT
            )
            sm.send(pb)
        logs = backend.get_run_logs("r-1")
        assert any("hello stdout" in l["message"] for l in logs)


class TestArtifactLinkAlert:
    def test_alert_posted(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        with tempfile.TemporaryDirectory() as tmp:
            sm = _make_sm(url, os.path.join(tmp, "files"))
            sm.send_run(_make_run_pb(), file_dir=tmp)
            pb = wandb_internal_pb2.Record()
            pb.alert.title = "Loss spiked"
            pb.alert.text = "loss > 2.0"
            pb.alert.level = "ERROR"
            sm.send(pb)
        alerts = backend.get_run_alerts("r-1")
        assert any(a["title"] == "Loss spiked" for a in alerts)

    def test_link_artifact(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        # Seed an artifact version so /versions/{id}/link succeeds.
        backend.seed_artifact_version("v-1")
        with tempfile.TemporaryDirectory() as tmp:
            sm = _make_sm(url, os.path.join(tmp, "files"))
            sm.send_run(_make_run_pb(), file_dir=tmp)
            pb = wandb_internal_pb2.Record()
            req = pb.request.link_artifact
            req.server_id = "v-1"
            req.portfolio_name = "fashion-mnist"
            req.portfolio_project = "registry"
            req.portfolio_aliases.extend(["latest"])
            pb.control.req_resp = True
            sm.send(pb)
        links = backend.get_portfolio_links("v-1")
        assert any(l["portfolioName"] == "fashion-mnist" for l in links)


class TestStopAndUseArtifact:
    def test_should_stop(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        with tempfile.TemporaryDirectory() as tmp:
            sm = _make_sm(url, os.path.join(tmp, "files"))
            sm.send_run(_make_run_pb(), file_dir=tmp)
            # Default: shouldStop=false.
            pb = wandb_internal_pb2.Record()
            req = pb.request.stop_status
            pb.control.req_resp = True
            sm.send(pb)
            result = pb.request  # placeholder; the real result is in result_q
            assert sm._result_q.qsize() == 1
            res = sm._result_q.get_nowait()
            assert res.response.stop_status_response.run_should_stop is False
            # Toggle stop and ask again.
            backend.set_should_stop("r-1", True)
            pb2 = wandb_internal_pb2.Record()
            pb2.request.stop_status.CopyFrom(req)
            pb2.control.req_resp = True
            sm.send(pb2)
            res2 = sm._result_q.get_nowait()
            assert res2.response.stop_status_response.run_should_stop is True

    def test_use_artifact_recorded(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        with tempfile.TemporaryDirectory() as tmp:
            sm = _make_sm(url, os.path.join(tmp, "files"))
            sm.send_run(_make_run_pb(), file_dir=tmp)
            pb = wandb_internal_pb2.Record()
            pb.use_artifact.id = "v-99"
            pb.use_artifact.type = "input"
            sm.send(pb)
        used = backend.get_run_used_artifacts("r-1")
        assert any(u["artifactVersionId"] == "v-99" for u in used)


class TestExit:
    def test_finish_calls_finish_run(self, fake_backend: Any) -> None:
        url, backend = fake_backend
        with tempfile.TemporaryDirectory() as tmp:
            sm = _make_sm(url, os.path.join(tmp, "files"))
            sm.send_run(_make_run_pb(), file_dir=tmp)
            sm.finish()
        run = backend.get_run("r-1")
        assert run["status"] == "finished"


class TestSetupFactory:
    def test_setup_factory_reads_env_base_url(
        self, fake_backend: Any,
    ) -> None:
        url, backend = fake_backend
        os.environ["LUMINA_API_URL"] = url
        try:
            with tempfile.TemporaryDirectory() as tmp:
                os.makedirs(os.path.join(tmp, "files"), exist_ok=True)
                sm = SendManager.setup(tmp, resume=None)
                with sm:
                    sm.send_run(_make_run_pb(name="sync-1"), file_dir=tmp)
            assert backend.get_run("sync-1")["runId"] == "sync-1"
        finally:
            del os.environ["LUMINA_API_URL"]