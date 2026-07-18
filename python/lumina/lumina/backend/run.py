"""Run abstraction for the Lumina backend path.

This module provides `LuminaRun`, a lightweight run object that mirrors the
public interface of `wandb.sdk.wandb_run.Run` while talking to the Lumina
backend instead of Wandb.
"""

from __future__ import annotations

import warnings
from typing import Any, Callable, TextIO

from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context


class _DictLike:
    """Base class for dict-like config/summary objects."""

    def __init__(self, initial: dict[str, Any] | None = None) -> None:
        self._data: dict[str, Any] = dict(initial) if initial else {}

    def __getitem__(self, key: str) -> Any:
        return self._data[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self._data[key] = value

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
        if data:
            self._data.update(data)
        if kwargs:
            self._data.update(kwargs)

    def as_dict(self) -> dict[str, Any]:
        return dict(self._data)


class LuminaConfig(_DictLike):
    """Config object for a Lumina run.

    Behaves like `wandb.sdk.wandb_config.Config`: supports both attribute
    and item access, ``.update()``, ``.as_dict()``.
    """

    pass


class LuminaSummary(_DictLike):
    """Summary object for a Lumina run.

    Behaves like `wandb.sdk.wandb_summary.Summary`: supports both attribute
    and item access, ``.update()``, ``.as_dict()``.
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
        self._config = LuminaConfig(config)
        self._summary = LuminaSummary()
        self._step = 0
        self._finished = False

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
    # Wandb-compatible stubs (not yet backed by Lumina backend)
    # ------------------------------------------------------------------
    def save(
        self,
        glob_str: str,
        base_path: str | None = None,
        policy: str = "live",
        glob: bool = True,
    ) -> bool | list[str]:
        """Save files to the run. (Stub)"""
        warnings.warn("lumina.Run.save() is not yet backed by the Lumina backend.")
        return []

    def restore(
        self,
        name: str,
        run_path: str | None = None,
        replace: bool = False,
        root: str | None = None,
    ) -> TextIO | None:
        """Restore a file from a run. (Stub)"""
        warnings.warn("lumina.Run.restore() is not yet backed by the Lumina backend.")
        return None

    def watch(
        self,
        models: Any,
        criterion: Any | None = None,
        log: str = "gradients",
        log_freq: int = 1000,
        idx: int | None = None,
        log_graph: bool = False,
    ) -> None:
        """Watch a PyTorch model. (Stub)"""
        warnings.warn("lumina.Run.watch() is not yet backed by the Lumina backend.")

    def unwatch(self, models: Any | None = None) -> None:
        """Unwatch models. (Stub)"""
        warnings.warn("lumina.Run.unwatch() is not yet backed by the Lumina backend.")

    def define_metric(
        self,
        name: str,
        step_metric: str | None = None,
        step_sync: bool | None = None,
        hidden: bool | None = None,
        summary: str | None = None,
        goal: str | None = None,
        overwrite: bool | None = None,
    ) -> Any:
        """Define metric customization. (Stub)"""
        warnings.warn("lumina.Run.define_metric() is not yet backed by the Lumina backend.")
        return None

    def mark_preempting(self) -> None:
        """Mark the run as preempting. (Stub)"""
        warnings.warn("lumina.Run.mark_preempting() is not yet backed by the Lumina backend.")

    def alert(
        self,
        title: str,
        text: str,
        level: str | None = None,
        wait_duration: Any | None = None,
    ) -> None:
        """Create an alert. (Stub)"""
        warnings.warn("lumina.Run.alert() is not yet backed by the Lumina backend.")

    def pin_config_keys(self, keys: list[str] = ()) -> None:
        """Pin config keys. (Stub)"""
        warnings.warn("lumina.Run.pin_config_keys() is not yet backed by the Lumina backend.")
