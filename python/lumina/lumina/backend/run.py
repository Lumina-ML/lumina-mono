"""Run abstraction for the Lumina backend path.

This module provides `LuminaRun`, a lightweight run object that mirrors the
public interface of `wandb.sdk.wandb_run.Run` while talking to the Lumina
backend instead of Wandb.
"""

from __future__ import annotations

import os
import warnings
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, TextIO

from lumina.backend.client import LuminaClient, LuminaClientError
from lumina.backend.run_context import get_run_context
from lumina.sdk.wandb_alerts import AlertLevel


class _DictLike:
    """Base class for dict-like config/summary objects.

    Optionally accepts a ``sync_callback`` that is invoked with the current
    data dict after every mutation. This allows `LuminaRun` to push config
    and summary changes to the Lumina backend.
    """

    def __init__(
        self,
        initial: dict[str, Any] | None = None,
        sync_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        # Use object.__setattr__ to bypass our own override during init.
        object.__setattr__(self, "_data", dict(initial) if initial else {})
        object.__setattr__(self, "_sync_callback", sync_callback)

    def _trigger_sync(self) -> None:
        callback = object.__getattribute__(self, "_sync_callback")
        if callback:
            callback(self._data)

    def __getitem__(self, key: str) -> Any:
        return self._data[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self._data[key] = value
        self._trigger_sync()

    def __getattr__(self, key: str) -> Any:
        if key.startswith("_"):
            raise AttributeError(key)
        try:
            return self._data[key]
        except KeyError as e:
            raise AttributeError(key) from e

    def __setattr__(self, key: str, value: Any) -> None:
        if key.startswith("_"):
            object.__setattr__(self, key, value)
        else:
            self._data[key] = value
            self._trigger_sync()

    def __delitem__(self, key: str) -> None:
        del self._data[key]
        self._trigger_sync()

    __delattr__ = __delitem__

    def __contains__(self, key: str) -> bool:
        return key in self._data

    def __iter__(self):
        return iter(self._data)

    def __repr__(self) -> str:
        return repr(self._data)

    def keys(self) -> list[str]:
        return list(self._data.keys())

    def values(self) -> list[Any]:
        return list(self._data.values())

    def items(self) -> list[tuple[str, Any]]:
        return list(self._data.items())

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def update(
        self,
        data: dict[str, Any] | None = None,
        allow_val_change: bool | None = None,
        **kwargs: Any,
    ) -> None:
        changed = False
        if data:
            self._data.update(data)
            changed = True
        if kwargs:
            self._data.update(kwargs)
            changed = True
        if changed:
            self._trigger_sync()

    def as_dict(self) -> dict[str, Any]:
        return dict(self._data)


class LuminaConfig(_DictLike):
    """Config object for a Lumina run.

    Behaves like `wandb.sdk.wandb_config.Config`: supports both attribute
    and item access, ``.update()``, ``.as_dict()``.

    Mutations are synced to the Lumina backend via the callback provided by
    the owning `LuminaRun`.
    """

    pass


class LuminaSummary(_DictLike):
    """Summary object for a Lumina run.

    Behaves like `wandb.sdk.wandb_summary.Summary`: supports both attribute
    and item access, ``.update()``, ``.as_dict()``.

    Mutations are synced to the Lumina backend via the callback provided by
    the owning `LuminaRun`.
    """

    pass


class LuminaRun:
    """A run backed by the Lumina backend.

    This class provides a `wandb.Run`-compatible surface so that top-level
    helpers such as ``lumina.config``, ``lumina.summary``,
    ``lumina.define_metric()``, ``lumina.watch()`` can be rebound to the
    active run after ``lumina.init()``.
    """

    def __init__(
        self,
        run_id: str,
        project: str,
        name: str | None = None,
        config: dict[str, Any] | None = None,
        sweep_id: str | None = None,
        client: LuminaClient | None = None,
    ) -> None:
        self._run_id = run_id
        self._project = project
        self._name = name
        self._sweep_id = sweep_id
        self._client = client or LuminaClient()
        self._config = LuminaConfig(config, sync_callback=self._sync_config)
        self._summary = LuminaSummary(sync_callback=self._sync_summary)
        self._metric_defs: dict[str, dict[str, Any]] = {}
        self._alerts: list[dict[str, Any]] = []
        self._alert_last_sent: dict[str, datetime] = {}
        self._torch_watcher: Any | None = None
        self._step = 0
        self._finished = False

    def _sync_config(self, data: dict[str, Any]) -> None:
        if self._finished:
            return
        self._client.update_run(self._run_id, config=data)

    def _sync_summary(self, data: dict[str, Any]) -> None:
        if self._finished:
            return
        self._client.update_run(self._run_id, summary=data)

    # ------------------------------------------------------------------
    # Properties mirroring wandb.Run
    # ------------------------------------------------------------------
    @property
    def id(self) -> str:
        return self._run_id

    @property
    def run_id(self) -> str:
        return self._run_id

    @property
    def project(self) -> str:
        return self._project

    @property
    def project_name(self) -> str:
        return self._project

    @property
    def name(self) -> str | None:
        return self._name

    @name.setter
    def name(self, value: str | None) -> None:
        self._name = value

    @property
    def sweep_id(self) -> str | None:
        return self._sweep_id

    @property
    def config(self) -> LuminaConfig:
        return self._config

    @property
    def summary(self) -> LuminaSummary:
        return self._summary

    @property
    def step(self) -> int:
        return self._step

    @property
    def url(self) -> str | None:
        base = self._client.base_url
        return f"{base}/projects/{self._project}/runs/{self._run_id}"

    @property
    def path(self) -> str:
        return f"{self._project}/{self._run_id}"

    @property
    def dir(self) -> str:
        return "."

    # ------------------------------------------------------------------
    # Backward-compatible dict access: run["runId"]
    # ------------------------------------------------------------------
    def __getitem__(self, key: str) -> Any:
        mapping = {
            "runId": self._run_id,
            "id": self._run_id,
            "project": self._project,
            "name": self._name,
            "sweepId": self._sweep_id,
            "sweep_id": self._sweep_id,
        }
        if key in mapping:
            return mapping[key]
        raise KeyError(key)

    def __enter__(self) -> "LuminaRun":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.finish()

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------
    def log(
        self,
        metrics: dict[str, Any],
        step: int | None = None,
        commit: bool | None = None,
        **kwargs: Any,
    ) -> None:
        """Log metrics for this run."""
        if step is not None:
            self._step = step
        scalar_metrics: dict[str, Any] = {}
        for key, value in metrics.items():
            from lumina.backend.media import _is_media_value, _infer_media_type, log_media

            if _is_media_value(value):
                log_media(key, value, type=_infer_media_type(value), run_id=self._run_id)
            else:
                scalar_metrics[key] = value
        if scalar_metrics:
            self._client.log_metrics(self._run_id, scalar_metrics, self._step)
            # Mirror wandb behavior: keep the latest scalar value in summary,
            # unless the metric is explicitly hidden or summary aggregation
            # is disabled.
            self._update_summary_from_metrics(scalar_metrics)

    def _update_summary_from_metrics(self, metrics: dict[str, Any]) -> None:
        """Update the local summary with the latest scalar metrics.

        This avoids triggering a backend sync on every log call; the final
        aggregated summary is pushed once in ``finish()``.
        """
        for key, value in metrics.items():
            if not isinstance(value, (int, float)):
                continue
            definition = self._metric_defs.get(key, {})
            if definition.get("hidden"):
                continue
            summary_mode = definition.get("summary", "last")
            if summary_mode == "none":
                continue
            # Directly update internal data to avoid per-step backend sync.
            self._summary._data[key] = value

    def _compute_summary_aggregations(self) -> dict[str, Any]:
        """Fetch all metrics and compute summary aggregations.

        Returns a dict ready to be sent as the run summary.
        """
        # Start from manually-set summary values.
        summary = dict(self._summary._data)

        if not self._metric_defs:
            return summary

        # Fetch metrics from the backend. Limit is high enough for MVP runs.
        result = self._client.list_metrics(self._run_id, limit=10000)
        grouped = result.get("metrics", {})

        # Group values by metric key.
        series: dict[str, list[float]] = {}
        for key, entries in grouped.items():
            if not isinstance(entries, list):
                continue
            values: list[float] = []
            for entry in entries:
                value = entry.get("value")
                if isinstance(value, (int, float)):
                    values.append(float(value))
            if values:
                series[key] = values

        for key, definition in self._metric_defs.items():
            if definition.get("hidden"):
                continue
            summary_mode = definition.get("summary", "last")
            values = series.get(key, [])
            if not values:
                continue

            if summary_mode == "none":
                continue
            if summary_mode == "last":
                summary[key] = values[-1]
            elif summary_mode == "first":
                summary[key] = values[0]
            elif summary_mode == "min":
                summary[key] = min(values)
            elif summary_mode == "max":
                summary[key] = max(values)
            elif summary_mode == "mean":
                summary[key] = sum(values) / len(values)
            elif summary_mode == "best":
                goal = definition.get("goal", "minimize")
                if goal == "maximize":
                    summary[key] = max(values)
                else:
                    summary[key] = min(values)

        return summary

    def log_system(self, metrics: dict[str, Any], step: int | None = None) -> None:
        """Log system metrics for this run."""
        self._client.log_system_metrics(self._run_id, metrics, step)

    def log_line(self, message: str, level: str = "INFO", step: int | None = None) -> None:
        """Log a console line for this run."""
        self._client.log_lines(
            self._run_id,
            [{"level": level, "message": message, "step": step}],
        )

    def add_tag(self, name: str, color: str | None = None) -> None:
        """Attach a tag to this run."""
        self._client.add_tag(self._run_id, name, color)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def finish(
        self,
        exit_code: int | None = None,
        quiet: bool | None = None,
        **kwargs: Any,
    ) -> None:
        """Finish this run."""
        if self._finished:
            return
        # Compute final summary aggregations and push them once.
        final_summary = self._compute_summary_aggregations()
        if final_summary:
            self._client.update_run(self._run_id, summary=final_summary)
        # Push any alerts captured during the run.
        if self._alerts:
            self._client.update_run(
                self._run_id,
                metadata={"_lumina_alerts": self._alerts},
            )
        self._client.finish_run(self._run_id)
        self._finished = True
        # Reset global module bindings so subsequent top-level calls fail
        # gracefully until the next init().
        from lumina.sdk.lib import module as _module

        _module.unset_globals()

    # ------------------------------------------------------------------
    # Artifact / Model Registry
    # ------------------------------------------------------------------
    def log_artifact(
        self,
        artifact_or_path: Any,
        name: str | None = None,
        type: str | None = None,
        aliases: list[str] | None = None,
        tags: list[str] | None = None,
    ) -> Any:
        """Log an artifact as an output of this run."""
        from lumina.backend.artifact import LuminaArtifact

        if isinstance(artifact_or_path, LuminaArtifact):
            return artifact_or_path.save(project=self._project)
        if isinstance(artifact_or_path, str):
            art = LuminaArtifact(
                name=name or artifact_or_path,
                type=type or "file",
                description=None,
            )
            art.add_file(artifact_or_path)
            return art.save(project=self._project)
        raise TypeError("log_artifact expects a LuminaArtifact or file path")

    def use_artifact(
        self,
        artifact_or_name: str | Any,
        type: str | None = None,
        aliases: list[str] | None = None,
        use_as: str | None = None,
    ) -> Any:
        """Declare an artifact as an input to this run."""
        from lumina.backend.artifact import use_lumina_artifact

        if isinstance(artifact_or_name, str):
            alias = "latest"
            name = artifact_or_name
            if ":" in name:
                name, alias = name.split(":", 1)
            return use_lumina_artifact(name, project=self._project, alias=alias)
        raise TypeError("use_artifact expects an artifact name string")

    def log_model(
        self,
        path: str,
        name: str | None = None,
        *,
        description: str | None = None,
        aliases: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Any:
        """Log a model to the model registry for this run's project."""
        from lumina.backend.model_registry import log_model as _log_model

        return _log_model(
            path,
            name,
            description=description,
            aliases=aliases,
            metadata=metadata,
            project=self._project,
        )

    def use_model(
        self,
        name: str,
        *,
        alias: str = "latest",
        download_dir: str | None = None,
    ) -> Any:
        """Download a model from the model registry."""
        from lumina.backend.model_registry import use_model as _use_model

        return _use_model(name, alias=alias, project=self._project, download_dir=download_dir)

    def link_model(
        self,
        path: str,
        registered_model_name: str,
        *,
        name: str | None = None,
        aliases: list[str] | None = None,
    ) -> Any:
        """Link a local model file to a registered model."""
        from lumina.backend.model_registry import link_model as _link_model

        return _link_model(
            path,
            registered_model_name,
            name=name,
            aliases=aliases,
            project=self._project,
        )

    # ------------------------------------------------------------------
    # Save / restore (backed by /api/v1/runs/:runId/files)
    # ------------------------------------------------------------------
    def save(
        self,
        glob_str: str | os.PathLike,
        base_path: str | os.PathLike | None = None,
        policy: str = "live",
        glob: bool = True,
    ) -> list[str]:
        """Upload one or more files matching ``glob_str`` to the Lumina backend.

        With ``glob=True`` (default), ``glob_str`` is interpreted as a glob
        pattern relative to ``base_path`` (or the cwd). With ``glob=False``,
        ``glob_str`` is treated as a single file path.

        Returns the list of uploaded relative paths.
        """
        import glob as _glob
        import os as _os
        from pathlib import Path

        base = Path(_os.fspath(base_path)) if base_path is not None else Path.cwd()
        glob_str_str = _os.fspath(glob_str)
        pattern = str(base / glob_str_str) if base_path is not None else glob_str_str

        if glob:
            # pathlib.rglob matches the pattern recursively under `base`,
            # which matches wandb semantics for `save("*.txt", base_path=...)`.
            # Strip the base prefix so the saved paths are relative.
            matches = sorted(str(p) for p in base.rglob(glob_str_str) if p.is_file())
        else:
            matches = [pattern]

        if not matches:
            warnings.warn(f"lumina.Run.save() matched no files for {pattern!r}")
            return []

        uploaded: list[str] = []
        for full_path in matches:
            full_path_p = Path(full_path)
            if not full_path_p.is_file():
                continue
            rel_path = str(full_path_p.relative_to(base)) if base_path is not None else full_path_p.name
            with open(full_path_p, "rb") as fh:
                content = fh.read()
            self._client.save_run_file(self._run_id, rel_path, content, policy=policy)
            uploaded.append(rel_path)
        return uploaded

    def restore(
        self,
        name: str,
        run_path: str | None = None,
        replace: bool = False,
        root: str | None = None,
    ) -> TextIO | None:
        """Restore a file previously saved with :meth:`save` from another run.

        ``name`` is the path within the run. ``run_path`` may be either
        ``"<project>/<run_id>"`` or just the run id; if omitted, the file
        is restored from the current run.
        """
        import io
        import os as _os
        import tempfile as _tempfile

        target_run_id = self._run_id
        if run_path:
            # Accept "project/runId" or "runId"
            parts = run_path.split("/")
            target_run_id = parts[-1] if len(parts) > 1 else run_path

        try:
            data = self._client.restore_run_file(target_run_id, name)
        except LuminaClientError as exc:
            warnings.warn(f"lumina.Run.restore() failed: {exc}")
            return None

        dest = _os.path.join(root or _os.getcwd(), name)
        dest_dir = _os.path.dirname(dest)
        if dest_dir:
            _os.makedirs(dest_dir, exist_ok=True)
        mode = "wb" if replace or not _os.path.exists(dest) else "xb"
        try:
            with open(dest, mode) as fh:
                fh.write(data)
        except FileExistsError:
            # File exists and replace=False: leave it untouched.
            pass
        return io.BytesIO(data)

    def watch(
        self,
        models: Any,
        criterion: Any | None = None,
        log: str = "gradients",
        log_freq: int = 1000,
        idx: int | None = None,
        log_graph: bool = False,
    ) -> None:
        """Watch a PyTorch model and log parameter/gradient statistics."""
        from lumina.backend.torch_watch import LuminaTorchWatcher

        if self._torch_watcher is None:
            self._torch_watcher = LuminaTorchWatcher(log_callback=lambda metrics: self.log(metrics))
        self._torch_watcher.watch(
            models,
            criterion=criterion,
            log=log,
            log_freq=log_freq,
            idx=idx,
            log_graph=log_graph,
        )

    def unwatch(self, models: Any | None = None) -> None:
        """Unwatch models."""
        if self._torch_watcher is not None:
            self._torch_watcher.unwatch(models)

    def define_metric(
        self,
        name: str,
        step_metric: str | None = None,
        step_sync: bool | None = None,
        hidden: bool | None = None,
        summary: str | None = None,
        goal: str | None = None,
        overwrite: bool | None = None,
    ) -> dict[str, Any]:
        """Define how a metric should be summarized and displayed.

        Supported ``summary`` aggregations: ``last``, ``first``, ``min``,
        ``max``, ``mean``, ``best``, ``none``.
        """
        if not overwrite and name in self._metric_defs:
            return self._metric_defs[name]

        definition: dict[str, Any] = {"name": name}
        if step_metric is not None:
            definition["step_metric"] = step_metric
        if step_sync is not None:
            definition["step_sync"] = step_sync
        if hidden is not None:
            definition["hidden"] = hidden
        if summary is not None:
            definition["summary"] = summary
        if goal is not None:
            definition["goal"] = goal

        self._metric_defs[name] = definition
        return definition

    def mark_preempting(self) -> None:
        """Mark the run as preempting. Backed by the Lumina backend."""
        try:
            self._client.mark_preempting(self._run_id)
        except LuminaClientError as exc:
            warnings.warn(f"lumina.Run.mark_preempting() failed: {exc}")

    def pin_config_keys(self, *keys: str) -> None:
        """Pin one or more config keys so they show up first in summaries.

        Backed by ``PATCH /api/v1/runs/{runId}`` with
        ``metadata.pinnedConfigKeys``.
        """
        try:
            self._client.pin_config_keys(self._run_id, list(keys))
        except LuminaClientError as exc:
            warnings.warn(f"lumina.Run.pin_config_keys() failed: {exc}")

    def alert(
        self,
        title: str,
        text: str,
        level: str | AlertLevel | None = None,
        wait_duration: int | float | timedelta | None = None,
    ) -> None:
        """Create an alert for the run.

        Alerts are rate-limited by title. They are logged as console lines and
        pushed to the run's metadata under ``_lumina_alerts`` on finish.
        """
        level = level or AlertLevel.INFO
        level_str: str = level.value if isinstance(level, AlertLevel) else level
        if level_str not in {lev.value for lev in AlertLevel}:
            raise ValueError("level must be one of 'INFO', 'WARN', or 'ERROR'")

        wait_duration = wait_duration or timedelta(minutes=1)
        if isinstance(wait_duration, (int, float)):
            wait_duration = timedelta(seconds=wait_duration)

        now = datetime.now(timezone.utc)
        last_sent = self._alert_last_sent.get(title)
        if last_sent is not None and now - last_sent < wait_duration:
            # Rate-limited: skip this alert.
            return

        self._alert_last_sent[title] = now
        alert_record = {
            "title": title,
            "text": text,
            "level": level_str,
            "timestamp": now.isoformat(),
        }
        self._alerts.append(alert_record)
        # Also surface the alert as a log line for immediate visibility.
        log_level = {"INFO": "INFO", "WARN": "WARNING", "ERROR": "ERROR"}.get(
            level_str, "INFO"
        )
        self.log_line(f"[ALERT {level_str}] {title}: {text}", level=log_level)
