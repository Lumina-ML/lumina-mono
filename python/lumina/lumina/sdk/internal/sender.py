"""sender — REST-only writer that translates protobuf Record protos into
`LuminaClient` (REST) calls against the Lumina backend.

Step 3.2 of `refactor/drop_wandb_choas`: replaces the wandb-cloud GraphQL
client (`internal_api.Api`), the private file-stream protocol
(`file_stream.FileStreamApi`), the S3-multipart uploader
(`FilePusher`), and the directory watcher (`DirWatcher`). The
public API of `SendManager` is preserved so `lumina/sync/sync.py`
and the legacy wandb-core service binary keep working.
"""
from __future__ import annotations

import json
import logging
import os
import queue
import time
from datetime import datetime, timezone
from queue import Queue
from typing import TYPE_CHECKING, Any

from lumina.backend.client import LuminaClient, LuminaClientError
from lumina.errors import CommError, UsageError
from lumina.errors.util import ProtobufErrorHandler
from lumina.proto import wandb_internal_pb2
from lumina.sdk.interface.interface_queue import InterfaceQueue
from lumina.sdk.internal import datastore, sender_config
from lumina.sdk.internal.job_builder import JobBuilder
from lumina.sdk.internal.settings_static import SettingsStatic
from lumina.sdk.lib import filenames, filesystem, proto_util
from lumina.sdk.lib.proto_util import message_to_dict

if TYPE_CHECKING:
    from lumina.proto.wandb_internal_pb2 import (
        Record,
        Result,
        RunExitResult,
        RunRecord,
        SummaryRecord,
    )

logger = logging.getLogger(__name__)


class ResumeState:
    """Mirrors the resume-state response payload from
    ``GET /api/v1/runs/:id/resume-state``."""

    __slots__ = (
        "resumed", "step", "history", "events", "output",
        "runtime", "wandb_runtime", "summary", "config", "tags",
    )

    def __init__(self) -> None:
        self.resumed: bool = False
        self.step: int = 0
        self.history: int = 0
        self.events: int = 0
        self.output: int = 0
        self.runtime: float = 0.0
        self.wandb_runtime: int | None = None
        self.summary: dict[str, Any] | None = None
        self.config: dict[str, Any] | None = None
        self.tags: list[str] | None = None

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "ResumeState":
        s = cls()
        s.resumed = True
        history_tail = d.get("historyTail") or []
        events_tail = d.get("eventsTail") or []
        s.history = int(d.get("historyLineCount") or len(history_tail))
        s.events = int(d.get("eventsLineCount") or len(events_tail))
        s.output = int(d.get("logLineCount") or 0)
        s.summary = d.get("summaryMetrics")
        s.config = d.get("config")
        s.tags = list(d.get("tags") or [])
        max_step = 0
        for row in history_tail:
            try:
                max_step = max(max_step, int(row.get("step") or 0))
            except (TypeError, ValueError):
                continue
        s.step = max_step + 1 if max_step else 0
        return s


class SendManager:
    """Translates Record protos into LuminaClient REST calls.

    Single-mutator model preserved: the calling thread of ``send()``
    is the only writer to ``self._run`` / ``self._consolidated_config``
    / etc., so no locks are required. Each handler now blocks on
    ``self._client.<method>`` (urllib under the hood) instead of
    feeding a background FileStream / FilePusher thread.
    """

    UPDATE_CONFIG_TIME: int = 30
    UPDATE_STATUS_TIME: int = 5

    def __init__(
        self,
        settings: SettingsStatic,
        record_q: "Queue[Record]",
        result_q: "Queue[Result]",
        interface: InterfaceQueue,
        *,
        client: LuminaClient | None = None,
    ) -> None:
        self._settings = settings
        self._record_q = record_q
        self._result_q = result_q
        self._interface = interface
        self._client = client or LuminaClient()
        self._ds: datastore.DataStore | None = None
        self._run: "RunRecord | None" = None
        self._consolidated_config = sender_config.ConfigState()
        self._consolidated_summary: dict[str, Any] = {}
        self._cached_summary: dict[str, Any] = {}
        self._resume_state = ResumeState()
        self._config_metric_dict: dict[str, Any] = {}
        self._metadata_summary: dict[str, Any] = {}
        self._record_exit: "Record | None" = None
        self._exit_result: "RunExitResult | None" = None
        self._exit_code: int = 0
        files_dir = getattr(settings, "files_dir", "/tmp/lumina")
        self._job_builder = JobBuilder(settings, files_dir=files_dir)
        self._partial_output: dict[str, str] = {}
        self._config_needs_debounce: bool = False
        self._debounce_config_time: float = time.monotonic()

    # ----- factory used by sync.py + CLI -----
    @classmethod
    def setup(
        cls,
        root_dir: str,
        resume: None | bool | str,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
    ) -> "SendManager":
        """Construct a SendManager for offline / sync use.

        Honors ``base_url`` / ``api_key`` kwargs first, then falls back
        to ``LUMINA_API_URL`` / ``LUMINA_API_KEY`` env vars picked up by
        ``LuminaClient`` itself.
        """
        files_dir = os.path.join(root_dir, "files")
        try:
            import lumina as _lumina  # noqa: PLC0415 — optional when agents bug fixed
            settings_obj = _lumina.Settings(
                x_files_dir=files_dir,
                root_dir=root_dir,
                resume=resume,
                x_sync=True,
                disable_job_creation=False,
                x_file_stream_timeout_seconds=0,
            )
        except Exception:
            # Pre-existing `lumina/agents/agent.py:19` import bug means
            # `import lumina` may fail; fall back to a minimal SettingsStatic.
            settings_obj = SettingsStatic({
                "x_files_dir": files_dir,
                "root_dir": root_dir,
                "resume": resume,
                "x_sync": True,
            })

        record_q: "Queue[Record]" = queue.Queue()
        result_q: "Queue[Result]" = queue.Queue()
        publish_interface = InterfaceQueue(record_q=record_q)
        return cls(
            settings=SettingsStatic(dict(settings_obj)),
            record_q=record_q,
            result_q=result_q,
            interface=publish_interface,
            client=LuminaClient(base_url=base_url, api_key=api_key),
        )

    # ----- queue protocol -----
    def __len__(self) -> int:
        return self._record_q.qsize()

    def __enter__(self) -> "SendManager":
        return self

    def __exit__(self, *exc_info: Any) -> None:
        self.finish()

    def __next__(self) -> "Record":
        return self._record_q.get(block=True)

    next = __next__

    # ----- dispatch -----
    def send(self, record: "Record") -> None:
        record_type = record.WhichOneof("record_type")
        if record_type == "run":
            self.send_run(record)
        elif record_type == "history":
            self.send_history(record)
        elif record_type == "summary":
            self.send_summary(record)
        elif record_type == "stats":
            self.send_stats(record)
        elif record_type == "output":
            self.send_output(record)
        elif record_type == "output_raw":
            self.send_output_raw(record)
        elif record_type == "config":
            self.send_config(record)
        elif record_type == "metric":
            self.send_metric(record)
        elif record_type == "telemetry":
            self.send_telemetry(record)
        elif record_type == "environment":
            self.send_environment(record)
        elif record_type == "files":
            self.send_files(record)
        elif record_type == "artifact":
            self.send_artifact(record)
        elif record_type == "use_artifact":
            self.send_use_artifact(record)
        elif record_type == "alert":
            self.send_alert(record)
        elif record_type == "exit":
            self.send_exit(record)
        elif record_type == "preempting":
            self.send_preempting(record)
        elif record_type == "header":
            self.send_header(record)
        elif record_type == "footer":
            self.send_footer(record)
        elif record_type == "tb_record":
            self.send_tbrecord(record)
        elif record_type == "final":
            self.send_final(record)
        elif record.control.req_resp or record.control.mailbox_slot:
            self.send_request(record)
        else:
            logger.warning("sender: ignoring unknown record type %r", record_type)

    def send_request(self, record: "Record") -> None:
        req_type = record.WhichOneof("request_type")
        if req_type == "stop_status":
            self.send_request_stop_status(record)
        elif req_type == "summary_record":
            self.send_request_summary_record(record)
        elif req_type == "telemetry_record":
            self.send_request_telemetry_record(record)
        elif req_type == "link_artifact":
            self.send_request_link_artifact(record)
        elif req_type == "log_artifact":
            self.send_request_log_artifact(record)
        elif req_type == "sender_mark":
            self.send_request_sender_mark(record)
        elif req_type == "sender_read":
            self.send_request_sender_read(record)
        elif req_type == "defer":
            self.send_request_defer(record)
        elif req_type == "poll_exit":
            self.send_request_poll_exit(record)
        elif req_type == "status_report":
            self.send_request_status_report(record)
        elif req_type == "network_status":
            self.send_request_network_status(record)
        elif req_type == "python_packages":
            self.send_request_python_packages(record)
        else:
            logger.warning("sender: ignoring unknown request type %r", req_type)

    # ----- run lifecycle -----
    def send_run(self, record: "Record", file_dir: str | None = None) -> None:
        run = record.run
        is_init = self._run is None
        config_dict = self._consolidated_config.non_internal_config()
        if run.config:
            self._consolidated_config.update_from_proto(run.config)
            config_dict = self._config_backend_dict()
            self._config_save(config_dict)
        # Resume / rewind / fork exclusivity.
        do_rewind = run.branch_point.run == run.run_id
        do_fork = (not do_rewind) and run.branch_point.run != ""
        do_resume = bool(self._settings.resume)
        if sum([do_fork, do_rewind, do_resume]) > 1:
            err = self._usage_error(
                "Multiple resume options specified. Specify only one of `resume`, `fork_from`, `rewind`.",
            )
            self._handle_error(record, err, run)
            return
        if is_init:
            if do_resume:
                self._setup_resume(run)
            elif do_rewind:
                self._load_rewind_state(run)
        if self._resume_state.config is not None:
            self._consolidated_config.merge_resumed_config(
                self._resume_state.config,
            )
            config_dict = self._config_backend_dict()
            self._config_save(config_dict)
        try:
            self._init_run(run, config_dict)
        except (CommError, UsageError) as exc:
            logger.error(exc, exc_info=True)
            self._handle_error(
                record, ProtobufErrorHandler.from_exception(exc), run,
            )
            return
        if do_fork:
            self._setup_fork()
        if record.control.req_resp or record.control.mailbox_slot:
            result = proto_util._result_from_record(record)
            result.run_result.run.CopyFrom(self._run)
            self._respond_result(result)
        if is_init:
            logger.info("started run: %s", self._run.run_id if self._run else run.run_id)

    def _init_run(self, run: "RunRecord", config_value_dict: dict[str, Any] | None) -> dict[str, Any]:
        start_time = run.start_time.ToMicroseconds() / 1_000_000.0
        start_time -= self._resume_state.runtime
        if self._resume_state.tags and run.tags:
            run.tags.extend(self._resume_state.tags)
        project = run.project or _auto_project_name(self._settings)
        kwargs = dict(
            project=project,
            name=run.run_id or None,
            config=self._to_native_config(config_value_dict),
            sweep_id=run.sweep_id or None,
            display_name=run.display_name or None,
            entity=run.entity or None,
            tags=list(run.tags) or None,
            group=run.group or None,
            job_type=run.job_type or None,
            notes=run.notes or None,
        )
        server_run = self._client.create_run(**kwargs)
        if self._run is None:
            self._run = run
        if rid := server_run.get("runId"):
            self._run.run_id = rid
        if dn := server_run.get("displayName"):
            self._run.display_name = dn
        if proj := server_run.get("project"):
            self._run.project = proj
        self._run.start_time.FromMicroseconds(int(start_time * 1_000_000.0))
        if self._resume_state.summary is not None:
            self._run.summary.update(self._resume_state.summary)
        self._run.starting_step = self._resume_state.step
        return server_run

    def _setup_resume(self, run: "RunRecord") -> None:
        try:
            state = self._client.get_run_resume_state(run.run_id)
        except LuminaClientError as exc:
            logger.warning("get_run_resume_state failed: %s", exc)
            if getattr(self._settings, "resume", None) == "must":
                raise
            return
        self._resume_state = ResumeState.from_dict(state)

    def _load_rewind_state(self, run: "RunRecord") -> None:
        result = self._client.rewind_run(
            run.run_id,
            metric_name=run.branch_point.metric,
            metric_value=run.branch_point.value,
            program_path=getattr(self._settings, "program", None) or None,
        )
        self._resume_state = ResumeState.from_dict(result)

    def _setup_fork(self) -> None:
        try:
            self._client.update_run(
                self._run.run_id,
                metadata={"_lumina_forked_from": self._run.fork_point.run},
            )
        except LuminaClientError as exc:
            logger.warning("fork metadata write failed: %s", exc)

    # ----- history / summary / stats / output -----
    def send_history(self, record: "Record") -> None:
        if not self._run:
            return
        history_dict = proto_util.dict_from_proto_list(record.history.item)
        step = history_dict.get("_step")
        try:
            self._client.log_metrics(self._run.run_id, history_dict, step=step)
        except LuminaClientError as exc:
            logger.warning("log_metrics failed: %s", exc)

    def send_summary(self, record: "Record") -> None:
        self._update_summary_record(record.summary)

    def send_request_summary_record(self, record: "Record") -> None:
        self._update_summary_record(record.request.summary_record.summary)

    def _update_summary_record(self, summary: "SummaryRecord") -> None:
        summary_dict = proto_util.dict_from_proto_list(summary.update)
        self._cached_summary = summary_dict
        self._update_summary()

    def _update_summary(self) -> None:
        if not self._run:
            return
        summary_dict = dict(self._cached_summary)
        summary_dict.pop("_wandb", None)
        if self._metadata_summary:
            summary_dict["_wandb"] = self._metadata_summary
        self._consolidated_summary.update(summary_dict)
        try:
            self._client.update_run(self._run.run_id, summary=summary_dict)
        except LuminaClientError as exc:
            logger.warning("update_run(summary) failed: %s", exc)
        summary_path = os.path.join(self._settings.files_dir, filenames.SUMMARY_FNAME)
        try:
            filesystem.mkdir_exists_ok(os.path.dirname(summary_path))
            with open(summary_path, "w") as fh:
                fh.write(json.dumps(self._consolidated_summary))
        except OSError as exc:
            logger.warning("local summary write failed: %s", exc)

    def send_stats(self, record: "Record") -> None:
        if not self._run:
            return
        if record.stats.stats_type != wandb_internal_pb2.StatsRecord.StatsType.SYSTEM:
            return
        now_us = record.stats.timestamp.ToMicroseconds()
        start_us = self._run.start_time.ToMicroseconds()
        d: dict[str, Any] = {}
        for item in record.stats.item:
            try:
                d[item.key] = json.loads(item.value_json)
            except json.JSONDecodeError:
                logger.exception("error decoding stats json: %s", item.value_json)
        d["_wandb"] = True
        d["_timestamp"] = now_us / 1_000_000.0
        d["_runtime"] = (now_us - start_us) / 1_000_000.0
        try:
            self._client.log_system_metrics(self._run.run_id, d)
        except LuminaClientError as exc:
            logger.warning("log_system_metrics failed: %s", exc)

    def send_output(self, record: "Record") -> None:
        if not self._run:
            return
        out = record.output
        stream = (
            "stderr"
            if out.output_type == wandb_internal_pb2.OutputRecord.OutputType.STDERR
            else "stdout"
        )
        self._send_output_line(stream, out.line)

    def send_output_raw(self, record: "Record") -> None:
        # Terminal-emulator compression (the old redirect.TerminalEmulator
        # dedup of `\r` progress bars) is intentionally removed — the
        # rewired path ships raw lines. See Issues §Fidelity gaps.
        if not self._run:
            return
        out = record.output_raw
        stream = (
            "stderr"
            if out.output_raw.output_type == wandb_internal_pb2.OutputRawRecord.OutputType.STDERR
            else "stdout"
        )
        self._send_output_line(stream, out.line)

    def _send_output_line(self, stream: str, line: str) -> None:
        if not line.endswith("\n"):
            if line.startswith("\r"):
                self._partial_output[stream] = ""
            self._partial_output[stream] = self._partial_output.get(stream, "") + line
            return
        timestamp = datetime.now(timezone.utc).isoformat() + " "
        prev = self._partial_output.pop(stream, "")
        full = f"{timestamp}{prev}{line}"
        if self._run:
            level = "ERROR" if stream == "stderr" else "INFO"
            try:
                self._client.log_lines(
                    self._run.run_id,
                    [{"level": level, "message": full}],
                )
            except LuminaClientError as exc:
                logger.warning("log_lines failed: %s", exc)

    def _output_raw_finish(self) -> None:
        for stream, pending in list(self._partial_output.items()):
            if pending:
                self._send_output_line(stream, pending + "\n")
        self._partial_output.clear()

    # ----- config / metric / telemetry -----
    def send_config(self, record: "Record") -> None:
        self._consolidated_config.update_from_proto(record.config)
        self._config_needs_debounce = True

    def send_metric(self, record: "Record") -> None:
        if not self._run:
            return
        metric = record.metric
        if metric.glob_name:
            logger.warning("Seen metric with glob (shouldn't happen)")
            return
        old = self._config_metric_dict.get(metric.name, {})
        merge = dict(metric) if metric._control.overwrite else {**old, **dict(metric)}
        self._config_metric_dict[metric.name] = merge
        try:
            self._client.update_run(
                self._run.run_id,
                metric_defs={metric.name: merge},
            )
        except LuminaClientError as exc:
            logger.warning("update_run(metricDefs) failed: %s", exc)

    def send_telemetry(self, record: "Record") -> None:
        if not self._run:
            return
        telemetry_dict = message_to_dict(record.telemetry)
        try:
            self._client.update_run(self._run.run_id, telemetry=telemetry_dict)
        except LuminaClientError as exc:
            logger.warning("update_run(telemetry) failed: %s", exc)

    def send_request_telemetry_record(self, record: "Record") -> None:
        if not self._run:
            return
        telemetry_dict = message_to_dict(record.request.telemetry_record.telemetry)
        try:
            self._client.update_run(self._run.run_id, telemetry=telemetry_dict)
        except LuminaClientError as exc:
            logger.warning("update_run(telemetry) failed: %s", exc)

    # ----- environment / files -----
    def send_environment(self, record: "Record") -> None:
        if not self._run:
            return
        env_dict = message_to_dict(record.environment)
        env_json = json.dumps(env_dict)
        env_path = os.path.join(self._settings.files_dir, filenames.METADATA_FNAME)
        try:
            filesystem.mkdir_exists_ok(os.path.dirname(env_path))
            with open(env_path, "w") as fh:
                fh.write(env_json)
        except OSError as exc:
            logger.warning("local metadata write failed: %s", exc)
        try:
            self._client.save_run_file(
                self._run.run_id,
                filenames.METADATA_FNAME,
                env_json.encode("utf-8"),
                policy="now",
            )
        except LuminaClientError as exc:
            logger.warning("save_run_file(metadata) failed: %s", exc)

    def send_files(self, record: "Record") -> None:
        if not self._run:
            return
        for f in record.files.files:
            path = f.path
            if not os.path.isfile(path):
                continue
            try:
                with open(path, "rb") as fh:
                    content = fh.read()
            except OSError as exc:
                logger.warning("send_files: read %s failed: %s", path, exc)
                continue
            policy = "live" if str(f.policy) == "POLICY_LIVE" else "end"
            try:
                self._client.save_run_file(
                    self._run.run_id,
                    os.path.basename(path),
                    content,
                    policy=policy,
                )
            except LuminaClientError as exc:
                logger.warning("save_run_file(%s) failed: %s", path, exc)

    # ----- artifact ops -----
    def send_artifact(self, record: "Record") -> None:
        try:
            self._send_artifact(record.artifact)
        except Exception:
            logger.exception("send_artifact failed")

    def send_request_log_artifact(self, record: "Record") -> None:
        result = proto_util._result_from_record(record)
        artifact = record.request.log_artifact.artifact
        try:
            res = self._send_artifact(artifact)
            if res:
                result.response.log_artifact_response.artifact_id = res["versionId"]
        except Exception as exc:
            result.response.log_artifact_response.error_message = (
                f'error logging artifact "{artifact.type}/{artifact.name}": {exc}'
            )
        self._respond_result(result)

    def _send_artifact(self, artifact: Any, history_step: int | None = None) -> dict[str, Any] | None:
        project = artifact.project
        if not project:
            return None
        proj = self._client.get_project_by_name(project)
        if proj is None:
            return None
        project_id = proj["id"]
        art = self._client.create_artifact(
            project_id=project_id,
            name=artifact.name,
            type=artifact.type or "file",
            description=artifact.description or None,
        )
        metadata = json.loads(artifact.metadata) if artifact.metadata else None
        version = self._client.create_artifact_version(
            artifact_id=art["id"],
            version=artifact.digest or "v0",
            aliases=list(artifact.aliases) or None,
            metadata=metadata,
        )
        version_id = version["id"]
        for entry in artifact.manifest.contents:
            try:
                self._client.add_artifact_file(
                    version_id=version_id,
                    path=entry.path,
                    size=entry.size or 0,
                    sha256=entry.digest or None,
                    reference_uri=entry.ref or None,
                )
            except LuminaClientError as exc:
                logger.warning("add_artifact_file %s failed: %s", entry.path, exc)
        self._client.finalize_artifact_version(version_id)
        if artifact.manifest.manifest_file_path:
            try:
                os.remove(artifact.manifest.manifest_file_path)
            except OSError:
                pass
        return {"id": art["id"], "versionId": version_id}

    def send_use_artifact(self, record: "Record") -> None:
        use = record.use_artifact
        if use.type == "job" and not use.partial.job_name:
            self._job_builder.disable = True
        elif use.partial.job_name:
            self._job_builder.set_partial_source_id(use.id)
        if self._run and use.id:
            try:
                self._client.record_run_use_artifact(
                    self._run.run_id,
                    artifact_version_id=use.id,
                    use_type=use.type or None,
                )
            except LuminaClientError as exc:
                logger.warning("record_run_use_artifact failed: %s", exc)

    # ----- alert / link -----
    def send_alert(self, record: "Record") -> None:
        if not self._run:
            return
        try:
            self._client.create_run_alert(
                self._run.run_id,
                title=record.alert.title,
                text=record.alert.text,
                level=record.alert.level or None,
            )
        except LuminaClientError as exc:
            logger.warning("create_run_alert failed: %s", exc)

    def send_request_link_artifact(self, record: "Record") -> None:
        if not (record.control.req_resp or record.control.mailbox_slot):
            raise ValueError(f"Expected req_resp or mailbox_slot, got: {record.control!r}")
        result = proto_util._result_from_record(record)
        link = record.request.link_artifact
        try:
            resp = self._client.link_artifact_to_portfolio(
                version_id=link.server_id,
                portfolio_name=link.portfolio_name,
                portfolio_project=link.portfolio_project,
                portfolio_entity=link.portfolio_entity or None,
                aliases=list(link.portfolio_aliases) or None,
            )
            result.response.link_artifact_response.version_index = resp.get("versionIndex", 0)
        except LuminaClientError as exc:
            org_or_entity = link.portfolio_organization or link.portfolio_entity
            result.response.link_artifact_response.error_message = (
                f'error linking artifact to "{org_or_entity}/{link.portfolio_project}/{link.portfolio_name}"; error: {exc}'
            )
        self._respond_result(result)

    # ----- preempting / stop / exit / finish -----
    def send_preempting(self, record: "Record") -> None:
        if not self._run:
            return
        try:
            self._client.mark_preempting(self._run.run_id)
        except LuminaClientError as exc:
            logger.warning("mark_preempting failed: %s", exc)

    def send_request_sender_mark(self, record: "Record") -> None:
        self._maybe_report_status(always=True)

    def send_request_sender_read(self, record: "Record") -> None:
        """Replay path used by `lumina sync`. Walks the .wandb file and
        re-feeds records through ``self.send()``."""
        if self._ds is None:
            self._ds = datastore.DataStore()
            self._ds.open_for_scan(self._settings.sync_file)
        start_offset = record.request.sender_read.start_offset
        final_offset = record.request.sender_read.final_offset
        self._ds.seek(start_offset)
        current_end_offset = 0
        while current_end_offset < final_offset:
            data = self._ds.scan_data()
            assert data
            current_end_offset = self._ds.get_offset()
            replay = wandb_internal_pb2.Record()
            replay.ParseFromString(data)
            self._update_end_offset(current_end_offset)
            self.send(replay)
            self.debounce()
        self._maybe_report_status(always=True)

    def send_request_stop_status(self, record: "Record") -> None:
        result = proto_util._result_from_record(record)
        status = result.response.stop_status_response
        status.run_should_stop = False
        if self._run:
            try:
                status.run_should_stop = self._client.should_stop(self._run.run_id)
            except LuminaClientError as exc:
                logger.warning("should_stop failed: %s", exc)
        self._respond_result(result)

    def send_request_network_status(self, record: "Record") -> None:
        # No retry queue in REST mode; always empty.
        self._respond_result(proto_util._result_from_record(record))

    def send_request_status_report(self, record: "Record") -> None:
        pass

    def send_request_poll_exit(self, record: "Record") -> None:
        if not (record.control.req_resp or record.control.mailbox_slot):
            return
        result = proto_util._result_from_record(record)
        if self._exit_result is not None:
            result.response.poll_exit_response.done = True
            result.response.poll_exit_response.exit_result.CopyFrom(self._exit_result)
        self._respond_result(result)

    def send_request_python_packages(self, record: "Record") -> None:
        from lumina.sdk.lib.filenames import REQUIREMENTS_FNAME
        installed = sorted(
            f"{r.name}=={r.version}"
            for r in record.request.python_packages.package
        )
        path = os.path.join(self._settings.files_dir, REQUIREMENTS_FNAME)
        try:
            filesystem.mkdir_exists_ok(os.path.dirname(path))
            with open(path, "w") as fh:
                fh.write("\n".join(installed))
        except OSError as exc:
            logger.warning("requirements write failed: %s", exc)

    def send_request_defer(self, record: "Record") -> None:
        """Defer FSM. With FileStream/FilePusher/DirWatcher gone there
        are no threads to flush — only local cleanup + status publish."""
        defer = record.request.defer
        state = defer.state
        new_state = defer.state + 1
        self._interface.publish_defer(new_state)
        if state == defer.FLUSH_DEBOUNCER:
            self.debounce(final=True)
        elif state == defer.FLUSH_OUTPUT:
            self._output_raw_finish()
        elif state == defer.FLUSH_JOB:
            self._flush_job()
        elif state == defer.FLUSH_FINAL:
            self._interface.publish_final()
            self._interface.publish_footer()
        elif state == defer.END:
            self._exit_result = wandb_internal_pb2.RunExitResult()
            if self._record_exit and self._record_exit.control.mailbox_slot:
                result = proto_util._result_from_record(self._record_exit)
                result.exit_result.CopyFrom(self._exit_result)
                self._respond_result(result)

    def send_exit(self, record: "Record") -> None:
        self._record_exit = record
        self._exit_code = record.exit.exit_code
        self._metadata_summary["runtime"] = record.exit.runtime
        self._update_summary()
        self._interface.publish_defer()

    def send_header(self, record: "Record") -> None:
        pass

    def send_footer(self, record: "Record") -> None:
        pass

    def send_tbrecord(self, record: "Record") -> None:
        pass

    def send_final(self, record: "Record") -> None:
        pass

    def finish(self) -> None:
        logger.info("shutting down sender")
        self._output_raw_finish()
        if self._run is not None:
            try:
                self._client.finish_run(self._run.run_id)
            except LuminaClientError as exc:
                logger.warning("finish_run failed: %s", exc)

    # ----- debounce -----
    def debounce(self, final: bool = False) -> None:
        self._maybe_report_status(always=final)
        self._maybe_update_config(always=final)

    def _maybe_report_status(self, always: bool = False) -> None:
        # Lumina backend has no separate status heartbeat endpoint;
        # nothing to send here. Kept as a hook so callers can extend.
        pass

    def _maybe_update_config(self, always: bool = False) -> None:
        if not self._config_needs_debounce:
            return
        now = time.monotonic()
        if not always and now - self._debounce_config_time < self.UPDATE_CONFIG_TIME:
            return
        self._debounce_config_time = now
        self._debounce_config()

    def _debounce_config(self) -> None:
        if not self._run:
            return
        config_dict = self._config_backend_dict()
        try:
            self._client.update_run(
                self._run.run_id,
                config=self._to_native_config(config_dict),
            )
        except LuminaClientError as exc:
            logger.warning("update_run(config) failed: %s", exc)
        self._config_save(config_dict)
        self._config_needs_debounce = False

    # ----- helpers -----
    def _flush_job(self) -> None:
        try:
            self._job_builder.build()
        except Exception:
            logger.exception("JobBuilder.build failed")

    def _config_backend_dict(self) -> dict[str, Any]:
        """Build the wrapped ``{desc, value}`` config dict the
        downstream SDK surfaces still expect. The REST PATCH strips
        the wrapper before sending."""
        tree = self._consolidated_config._tree.copy()
        out: dict[str, Any] = {"_wandb": tree.pop("_wandb", {})}
        out.update(tree)
        return sender_config.BackendConfigDict(
            {key: {"desc": None, "value": value} for key, value in out.items()}
        )

    def _config_save(self, d: dict[str, Any]) -> None:
        path = os.path.join(self._settings.files_dir, "config.yaml")
        try:
            filesystem.mkdir_exists_ok(os.path.dirname(path))
            with open(path, "w") as fh:
                json.dump(d, fh)
        except OSError as exc:
            logger.warning("local config save failed: %s", exc)

    def _to_native_config(self, backend_dict: dict[str, Any] | None) -> dict[str, Any] | None:
        """Strip the ``{desc, value}`` wrapper before posting to REST."""
        if backend_dict is None:
            return None
        out: dict[str, Any] = {}
        for k, v in backend_dict.items():
            if isinstance(v, dict) and "value" in v:
                out[k] = v["value"]
            else:
                out[k] = v
        return out

    def _respond_result(self, result: "Result") -> None:
        self._result_q.put(result)

    def _handle_error(self, record: "Record", error: Any, run: "RunRecord") -> None:
        if record.control.req_resp or record.control.mailbox_slot:
            result = proto_util._result_from_record(record)
            result.run_result.error.CopyFrom(error)
            self._respond_result(result)

    def _update_record_num(self, n: int) -> None:
        pass

    def _update_end_offset(self, n: int) -> None:
        pass

    def _usage_error(self, msg: str) -> Any:
        return UsageError(msg)


def _auto_project_name(settings: Any) -> str:
    """Pick a project name when the SDK caller didn't pass one."""
    program = getattr(settings, "program", None) or "uncategorized"
    base = os.path.basename(program) or "uncategorized"
    return os.path.splitext(base)[0].replace(" ", "_") or "uncategorized"