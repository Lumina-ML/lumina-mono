import lumina
from . import preinit

def set_global(run=None, config=None, log=None, summary=None, save=None, use_artifact=None, log_artifact=None, define_metric=None, alert=None, mark_preempting=None, log_model=None, use_model=None, link_model=None, watch=None, unwatch=None):
    if run:
        lumina.run = run
    if config is not None:
        lumina.config = config
    if log:
        lumina.log = log
    if summary is not None:
        lumina.summary = summary
    if save:
        lumina.save = save
    if use_artifact:
        lumina.use_artifact = use_artifact
    if log_artifact:
        lumina.log_artifact = log_artifact
    if define_metric:
        lumina.define_metric = define_metric
    if alert:
        lumina.alert = alert
    if mark_preempting:
        lumina.mark_preempting = mark_preempting
    if log_model:
        lumina.log_model = log_model
    if use_model:
        lumina.use_model = use_model
    if link_model:
        lumina.link_model = link_model
    if watch:
        lumina.watch = watch
    if unwatch:
        lumina.unwatch = unwatch

def unset_globals():
    lumina.run = None
    lumina.config = preinit.PreInitObject('wandb.config')
    lumina.summary = preinit.PreInitObject('wandb.summary')
    lumina.log = preinit.PreInitCallable('wandb.log', lumina.Run.log)
    lumina.watch = preinit.PreInitCallable('wandb.watch', lumina.Run.watch)
    lumina.unwatch = preinit.PreInitCallable('wandb.unwatch', lumina.Run.unwatch)
    lumina.save = preinit.PreInitCallable('wandb.save', lumina.Run.save)
    lumina.use_artifact = preinit.PreInitCallable('wandb.use_artifact', lumina.Run.use_artifact)
    lumina.log_artifact = preinit.PreInitCallable('wandb.log_artifact', lumina.Run.log_artifact)
    lumina.define_metric = preinit.PreInitCallable('wandb.define_metric', lumina.Run.define_metric)
