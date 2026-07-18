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
lumina.wandb_lib = wandb_sdk.lib
init = wandb_sdk.init
setup = wandb_sdk.setup
attach = _attach = wandb_sdk._attach
teardown = _teardown = wandb_sdk.teardown
finish = wandb_sdk.finish
join = finish
login = wandb_sdk.login
helper = wandb_sdk.helper
sweep = wandb_sdk.sweep
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
from lumina.wandb_agent import agent
from lumina.plot import visualize, plot_table
from lumina.integration.sagemaker import sagemaker_auth
from lumina.sdk.internal import profiler
from lumina.sdk.wandb_run import Run
from lumina.sdk.artifacts.artifact_ttl import ArtifactTTL
Api = PublicApi
api = InternalApi()
run: Run | None = None
config = _preinit.PreInitObject('wandb.config', wandb_sdk.wandb_config.Config)
summary = _preinit.PreInitObject('wandb.summary', wandb_sdk.wandb_summary.Summary)
log = _preinit.PreInitCallable('wandb.log', Run.log)
watch = _preinit.PreInitCallable('wandb.watch', Run.watch)
unwatch = _preinit.PreInitCallable('wandb.unwatch', Run.unwatch)
save = _preinit.PreInitCallable('wandb.save', Run.save)
restore = wandb_sdk.wandb_run.restore
use_artifact = _preinit.PreInitCallable('wandb.use_artifact', Run.use_artifact)
log_artifact = _preinit.PreInitCallable('wandb.log_artifact', Run.log_artifact)
log_model = _preinit.PreInitCallable('wandb.log_model', Run.log_model)
use_model = _preinit.PreInitCallable('wandb.use_model', Run.use_model)
link_model = _preinit.PreInitCallable('wandb.link_model', Run.link_model)
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
__all__ = ('__version__', 'init', 'finish', 'setup', 'save', 'sweep', 'controller', 'agent', 'config', 'log', 'summary', 'join', 'Api', 'Graph', 'Image', 'Plotly', 'Video', 'Audio', 'Table', 'EvalTable', 'Html', 'box3d', 'Object3D', 'Molecule', 'Histogram', 'ArtifactTTL', 'log_artifact', 'use_artifact', 'log_model', 'use_model', 'link_model', 'define_metric', 'watch', 'unwatch', 'plot_table', 'Run')
