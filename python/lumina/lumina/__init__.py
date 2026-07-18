"""Use lumina to track machine learning work.

Train and fine-tune models, manage models from experimentation to production.

For guides and examples, see https://docs.lumina.ai.

For scripts and interactive notebooks, see https://github.com/lumina/examples.

For reference documentation, see https://docs.lumina.ai/models/ref/python.
"""
from __future__ import annotations
__version__ = '0.1.0.dev1'
from lumina.errors import Error
from lumina.errors.term import termsetup, termlog, termerror, termwarn
from lumina.sdk.lib import wb_logging as _wb_logging
_wb_logging.configure_wandb_logger()
from lumina import sdk as wandb_sdk
import lumina
import os as _os
from typing import Any, Optional
lumina.wandb_lib = wandb_sdk.lib

# Lumina backend integration: if LUMINA_API_URL is set, use the simplified
# backend path for init/log/finish. Otherwise fall back to WandB behavior.
from lumina.backend import LuminaClient, LuminaRun, get_run_context, reset_run_context
from lumina.backend.client import set_api_key
from lumina.backend.artifact import LuminaArtifact, use_lumina_artifact
from lumina.backend.model_registry import log_model as _lumina_log_model
from lumina.backend.model_registry import use_model as _lumina_use_model
from lumina.backend.model_registry import link_model as _lumina_link_model
from lumina.backend.evaluation import init_eval as _lumina_init_eval
from lumina.backend.evaluation import log_eval_result as _lumina_log_eval_result
from lumina.backend.evaluation import finish_eval as _lumina_finish_eval
from lumina.backend.trace import trace as _lumina_trace
from lumina.backend.trace import span as _lumina_span
from lumina.backend.trace import start_trace as _lumina_start_trace
from lumina.backend.trace import finish_trace as _lumina_finish_trace
from lumina.backend.trace import start_span as _lumina_start_span
from lumina.backend.trace import finish_span as _lumina_finish_span
from lumina.backend.report import LuminaReport
from lumina.backend.media import LuminaTable, log_media as _log_media
from lumina.backend.media import _is_media_value
from lumina.backend.launch import launch as _lumina_launch
from lumina.backend.launch import launch_agent as _lumina_launch_agent

_WANDB_INIT = wandb_sdk.init
_WANDB_FINISH = wandb_sdk.finish


def init(
    project: str | None = None,
    name: str | None = None,
    config: dict | None = None,
    sweep: str | None = None,
    **kwargs,
) -> LuminaRun | Any:
    """Start a Lumina run."""
    if _os.getenv("LUMINA_API_URL") or project:
        ctx = get_run_context()
        reset_run_context()
        ctx.project = project or _os.getenv("LUMINA_PROJECT", "uncategorized")
        ctx.name = name
        ctx.config = config or {}
        ctx.sweep_id = sweep
        client = LuminaClient()
        run_data = client.create_run(ctx.project, ctx.name, ctx.config, sweep_id=sweep)
        run_id = run_data["runId"]
        ctx.run_id = run_id
        run = LuminaRun(
            run_id=run_id,
            project=ctx.project,
            name=ctx.name,
            config=ctx.config,
            sweep_id=ctx.sweep_id,
            client=client,
        )
        get_run_context().__dict__.update(ctx.__dict__)
        # Rebind top-level helpers to the active run, matching wandb semantics.
        from lumina.sdk.lib import module as _module

        _module.set_global(
            run=run,
            config=run.config,
            log=run.log,
            summary=run.summary,
            save=run.save,
            use_artifact=run.use_artifact,
            log_artifact=run.log_artifact,
            define_metric=run.define_metric,
            alert=run.alert,
            watch=run.watch,
            unwatch=run.unwatch,
            mark_preempting=run.mark_preempting,
            log_model=run.log_model,
            use_model=run.use_model,
            link_model=run.link_model,
        )
        return run
    return _WANDB_INIT(project=project, name=name, config=config, **kwargs)


def login(api_key: Optional[str] = None, **kwargs):
    """Set the API key for Lumina backend authentication."""
    if api_key:
        set_api_key(api_key)
        return {"api_key": api_key}
    # Fall back to WandB login if not in Lumina backend mode
    return wandb_sdk.login(**kwargs)


def log(metrics: dict, step: int | None = None, **kwargs):
    """Log metrics for the current Lumina run."""
    ctx = get_run_context()
    if ctx.run_id or _os.getenv("LUMINA_API_URL"):
        if step is not None:
            ctx.step = step
        # Split scalar metrics from media objects
        scalar_metrics: dict[str, Any] = {}
        for key, value in metrics.items():
            if _is_media_value(value):
                from lumina.backend.media import _infer_media_type
                _log_media(key, value, type=_infer_media_type(value))
            else:
                scalar_metrics[key] = value
        if scalar_metrics:
            client = LuminaClient()
            client.log_metrics(ctx.run_id, scalar_metrics, ctx.step)
        return
    return _WANDB_LOG(metrics, step=step, **kwargs)


def log_system(metrics: dict, step: int | None = None, **kwargs):
    """Log system metrics for the current Lumina run."""
    if isinstance(lumina.run, LuminaRun):
        return lumina.run.log_system(metrics, step)
    ctx = get_run_context()
    if ctx.run_id:
        client = LuminaClient()
        client.log_system_metrics(ctx.run_id, metrics, step)
        return
    return _WANDB_LOG(metrics, step=step, **kwargs)


def log_line(message: str, level: str = "INFO", step: int | None = None, **kwargs):
    """Log a line of console output for the current Lumina run."""
    if isinstance(lumina.run, LuminaRun):
        return lumina.run.log_line(message, level, step)
    ctx = get_run_context()
    if ctx.run_id:
        client = LuminaClient()
        client.log_lines(ctx.run_id, [{"level": level, "message": message, "step": step}])
        return
    return _WANDB_LOG({"message": message, "level": level}, step=step, **kwargs)


def add_tag(name: str, color: str | None = None, **kwargs):
    """Attach a tag to the current Lumina run."""
    if isinstance(lumina.run, LuminaRun):
        return lumina.run.add_tag(name, color)
    ctx = get_run_context()
    if ctx.run_id:
        client = LuminaClient()
        client.add_tag(ctx.run_id, name, color)
        return
    return _WANDB_LOG({"tag": name}, step=0, **kwargs)


def finish(**kwargs):
    """Finish the current Lumina run."""
    if isinstance(lumina.run, LuminaRun):
        lumina.run.finish(**kwargs)
        reset_run_context()
        return
    ctx = get_run_context()
    if ctx.run_id:
        client = LuminaClient()
        client.finish_run(ctx.run_id)
        reset_run_context()
        return
    return _WANDB_FINISH(**kwargs)


setup = wandb_sdk.setup
attach = _attach = wandb_sdk._attach
teardown = _teardown = wandb_sdk.teardown
join = finish
helper = wandb_sdk.helper
controller = wandb_sdk.controller
require = wandb_sdk.require
Artifact = wandb_sdk.Artifact
AlertLevel = wandb_sdk.AlertLevel
Settings = wandb_sdk.Settings
Config = wandb_sdk.Config
from lumina.apis import InternalApi, PublicApi
from lumina.errors import CommError, UsageError
from lumina.sdk.lib import preinit as _preinit
from lumina.sdk.lib import lazyloader as _lazyloader
from lumina.integration.torch import wandb_torch
from lumina.sdk.data_types._private import _cleanup_media_tmp_dir
_cleanup_media_tmp_dir()
from lumina.data_types import Graph
from lumina.data_types import Image
from lumina.data_types import Plotly
from lumina.data_types import Video
from lumina.data_types import Audio
from lumina.data_types import Table
from lumina.data_types import EvalTable
from lumina.data_types import Html
from lumina.data_types import box3d
from lumina.data_types import Object3D
from lumina.data_types import Molecule
from lumina.data_types import Histogram
from lumina.data_types import Classes
from lumina.data_types import JoinedTable
from lumina.wandb_agent import agent as _wandb_agent
from lumina.backend.sweep import sweep, agent, get_sweep
from lumina.plot import visualize, plot_table
from lumina.integration.sagemaker import sagemaker_auth
from lumina.sdk.internal import profiler
from lumina.sdk.wandb_run import Run
_WANDB_LOG = Run.log
from lumina.sdk.artifacts.artifact_ttl import ArtifactTTL
Api = PublicApi
api = InternalApi()
run: Run | LuminaRun | None = None
config = _preinit.PreInitObject('wandb.config', wandb_sdk.wandb_config.Config)
summary = _preinit.PreInitObject('wandb.summary', wandb_sdk.wandb_summary.Summary)
# log is overridden by the Lumina backend path; do not wrap with PreInitCallable
# log = _preinit.PreInitCallable('lumina.log', log)
watch = _preinit.PreInitCallable('wandb.watch', Run.watch)
unwatch = _preinit.PreInitCallable('wandb.unwatch', Run.unwatch)
save = _preinit.PreInitCallable('wandb.save', Run.save)
restore = wandb_sdk.wandb_run.restore
use_artifact = _preinit.PreInitCallable('wandb.use_artifact', Run.use_artifact)
log_artifact = _preinit.PreInitCallable('wandb.log_artifact', Run.log_artifact)

_WANDB_LOG_MODEL = Run.log_model
_WANDB_USE_MODEL = Run.use_model
_WANDB_LINK_MODEL = Run.link_model


def log_model(path, name=None, *, description=None, aliases=None, metadata=None, project=None):
    if _os.getenv("LUMINA_API_URL") or get_run_context().project:
        return _lumina_log_model(
            path,
            name,
            description=description,
            aliases=aliases,
            metadata=metadata,
            project=project,
        )
    if run is not None:
        return run.log_model(path, name, aliases)
    raise lumina.Error('You must call wandb.init() before log_model()')


def use_model(name, *, alias="latest", project=None, download_dir=None):
    if _os.getenv("LUMINA_API_URL") or get_run_context().project:
        return _lumina_use_model(name, alias=alias, project=project, download_dir=download_dir)
    if run is not None:
        return run.use_model(name)
    raise lumina.Error('You must call wandb.init() before use_model()')


def link_model(path, registered_model_name, *, name=None, aliases=None, project=None):
    if _os.getenv("LUMINA_API_URL") or get_run_context().project:
        return _lumina_link_model(
            path,
            registered_model_name,
            aliases=aliases,
            project=project,
        )
    if run is not None:
        return run.link_model(path, registered_model_name, name, aliases)
    raise lumina.Error('You must call wandb.init() before link_model()')


def init_eval(name, *, dataset=None, model=None, project=None, metadata=None):
    return _lumina_init_eval(name, dataset=dataset, model=model, project=project, metadata=metadata)


def log_eval_result(key, value, metadata=None):
    return _lumina_log_eval_result(key, value, metadata)


def finish_eval(status="completed"):
    return _lumina_finish_eval(status)


def trace(name, *, trace_id=None, project=None, metadata=None):
    return _lumina_trace(name, trace_id=trace_id, project=project, metadata=metadata)


def span(name, *, span_id=None, trace_id=None, parent_span_id=None, kind="internal", input_data=None):
    return _lumina_span(
        name,
        span_id=span_id,
        trace_id=trace_id,
        parent_span_id=parent_span_id,
        kind=kind,
        input_data=input_data,
    )


def start_trace(name, *, trace_id=None, project=None, metadata=None):
    return _lumina_start_trace(name, trace_id=trace_id, project=project, metadata=metadata)


def finish_trace(trace_id=None, status="ok", latency_ms=None):
    return _lumina_finish_trace(trace_id, status=status, latency_ms=latency_ms)


def start_span(name, *, span_id=None, trace_id=None, parent_span_id=None, kind="internal", input_data=None):
    return _lumina_start_span(
        name,
        span_id=span_id,
        trace_id=trace_id,
        parent_span_id=parent_span_id,
        kind=kind,
        input_data=input_data,
    )


def finish_span(span_id=None, status="ok", output_data=None, latency_ms=None):
    return _lumina_finish_span(span_id, status=status, output_data=output_data, latency_ms=latency_ms)


def log_media(key, value, *, type="file", project=None, run_id=None, metadata=None):
    return _log_media(key, value, type=type, project=project, run_id=run_id, metadata=metadata)


def launch(queue, job, *, project=None, run_id=None, metadata=None):
    return _lumina_launch(queue, job, project=project, run_id=run_id, metadata=metadata)


def launch_agent(queue, *, project=None, poll_interval=2.0, max_runs=None, dry_run=False):
    return _lumina_launch_agent(queue, project=project, poll_interval=poll_interval, max_runs=max_runs, dry_run=dry_run)


define_metric = _preinit.PreInitCallable('wandb.define_metric', Run.define_metric)
mark_preempting = _preinit.PreInitCallable('wandb.mark_preempting', Run.mark_preempting)
alert = _preinit.PreInitCallable('wandb.alert', Run.alert)
pin_config_keys = _preinit.PreInitCallable('wandb.pin_config_keys', Run.pin_config_keys)
patched = {'tensorboard': [], 'keras': [], 'gym': []}
keras = _lazyloader.LazyLoader('wandb.keras', globals(), 'wandb.integration.keras')
sklearn = _lazyloader.LazyLoader('wandb.sklearn', globals(), 'wandb.sklearn')
tensorflow = _lazyloader.LazyLoader('wandb.tensorflow', globals(), 'wandb.integration.tensorflow')
xgboost = _lazyloader.LazyLoader('wandb.xgboost', globals(), 'wandb.integration.xgboost')
catboost = _lazyloader.LazyLoader('wandb.catboost', globals(), 'wandb.integration.catboost')
tensorboard = _lazyloader.LazyLoader('wandb.tensorboard', globals(), 'wandb.integration.tensorboard')
gym = _lazyloader.LazyLoader('wandb.gym', globals(), 'wandb.integration.gym')
lightgbm = _lazyloader.LazyLoader('wandb.lightgbm', globals(), 'wandb.integration.lightgbm')
jupyter = _lazyloader.LazyLoader('wandb.jupyter', globals(), 'wandb.jupyter')
sacred = _lazyloader.LazyLoader('wandb.sacred', globals(), 'wandb.integration.sacred')

def ensure_configured():
    global api
    api = InternalApi()

def set_trace():
    import pdb
    pdb.set_trace()
if wandb_sdk.lib.ipython.in_notebook():
    from IPython import get_ipython
    jupyter._load_ipython_extension(get_ipython())
if 'dev' in __version__:
    import lumina.env
    import os
    os.environ[lumina.env.ERROR_REPORTING] = os.environ.get(lumina.env.ERROR_REPORTING, 'false')
__all__ = ('__version__', 'init', 'finish', 'setup', 'save', 'sweep', 'controller', 'agent', 'config', 'log', 'summary', 'join', 'Api', 'Graph', 'Image', 'Plotly', 'Video', 'Audio', 'Table', 'EvalTable', 'Html', 'box3d', 'Object3D', 'Molecule', 'Histogram', 'ArtifactTTL', 'log_artifact', 'use_artifact', 'log_model', 'use_model', 'link_model', 'init_eval', 'log_eval_result', 'finish_eval', 'trace', 'span', 'start_trace', 'finish_trace', 'start_span', 'finish_span', 'LuminaReport', 'LuminaTable', 'LuminaRun', 'log_media', 'login', 'launch', 'launch_agent', 'define_metric', 'watch', 'unwatch', 'plot_table', 'Run')
