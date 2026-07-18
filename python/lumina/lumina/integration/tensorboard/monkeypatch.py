"""monkeypatch: patch code to add tensorboard hooks."""
from __future__ import annotations
import os
import re
import socket
from typing import Any
import lumina
import lumina.util
TENSORBOARD_C_MODULE = 'tensorflow.python.ops.gen_summary_ops'
TENSORBOARD_X_MODULE = 'tensorboardX.writer'
TENSORFLOW_PY_MODULE = 'tensorflow.python.summary.writer.writer'
TENSORBOARD_WRITER_MODULE = 'tensorboard.summary.writer.event_file_writer'
TENSORBOARD_PYTORCH_MODULE = 'torch.utils.tensorboard.writer'

def unpatch() -> None:
    for module, method in lumina.patched['tensorboard']:
        writer = lumina.util.get_module(module, lazy=False)
        setattr(writer, method, getattr(writer, f'orig_{method}'))
    lumina.patched['tensorboard'] = []

def patch(save: bool=True, tensorboard_x: bool | None=None, pytorch: bool | None=None, root_logdir: str='') -> None:
    if len(lumina.patched['tensorboard']) > 0:
        raise ValueError('Tensorboard already patched. Call `wandb.tensorboard.unpatch()` first; remove `sync_tensorboard=True` from `wandb.init`; or only call `wandb.tensorboard.patch` once.')
    lumina.util.get_module('tensorboard', required='Please install tensorboard package', lazy=False)
    c_writer = lumina.util.get_module(TENSORBOARD_C_MODULE, lazy=False)
    py_writer = lumina.util.get_module(TENSORFLOW_PY_MODULE, lazy=False)
    tb_writer = lumina.util.get_module(TENSORBOARD_WRITER_MODULE, lazy=False)
    pt_writer = lumina.util.get_module(TENSORBOARD_PYTORCH_MODULE, lazy=False)
    tbx_writer = lumina.util.get_module(TENSORBOARD_X_MODULE, lazy=False)
    if not pytorch and (not tensorboard_x) and c_writer:
        _patch_tensorflow2(writer=c_writer, module=TENSORBOARD_C_MODULE, save=save, root_logdir=root_logdir)
    if py_writer:
        _patch_file_writer(writer=py_writer, module=TENSORFLOW_PY_MODULE, save=save, root_logdir=root_logdir)
    if tb_writer:
        _patch_file_writer(writer=tb_writer, module=TENSORBOARD_WRITER_MODULE, save=save, root_logdir=root_logdir)
    if pt_writer:
        _patch_file_writer(writer=pt_writer, module=TENSORBOARD_PYTORCH_MODULE, save=save, root_logdir=root_logdir)
    if tbx_writer:
        _patch_file_writer(writer=tbx_writer, module=TENSORBOARD_X_MODULE, save=save, root_logdir=root_logdir)
    if not c_writer and (not tb_writer) and (not tb_writer):
        lumina.termerror('Unsupported tensorboard configuration')

def _patch_tensorflow2(writer: Any, module: Any, save: bool=True, root_logdir: str='') -> None:
    old_csfw_func = writer.create_summary_file_writer
    logdir_hist = []

    def new_csfw_func(*args: Any, **kwargs: Any) -> Any:
        logdir = kwargs['logdir'].numpy().decode('utf8') if hasattr(kwargs['logdir'], 'numpy') else kwargs['logdir']
        logdir_hist.append(logdir)
        root_logdir_arg = root_logdir
        if len(set(logdir_hist)) > 1 and root_logdir == '':
            lumina.termwarn('When using several event log directories, please call `wandb.tensorboard.patch(root_logdir="...")` before `wandb.init`')
        hostname = socket.gethostname()
        search = re.search(f'-\\d+_{hostname}', logdir)
        if search:
            root_logdir_arg = logdir[:search.span()[1]]
        elif root_logdir is not None and (not os.path.abspath(logdir).startswith(os.path.abspath(root_logdir))):
            lumina.termwarn(f'Found log directory outside of given root_logdir, dropping given root_logdir for event file in {logdir}')
            root_logdir_arg = ''
        _notify_tensorboard_logdir(logdir, save=save, root_logdir=root_logdir_arg)
        return old_csfw_func(*args, **kwargs)
    writer.orig_create_summary_file_writer = old_csfw_func
    writer.create_summary_file_writer = new_csfw_func
    lumina.patched['tensorboard'].append([module, 'create_summary_file_writer'])

def _patch_file_writer(writer: Any, module: Any, save: bool=True, root_logdir: str='') -> None:
    logdir_hist = []

    class TBXEventFileWriter(writer.EventFileWriter):

        def __init__(self, logdir: str, *args: Any, **kwargs: Any) -> None:
            logdir_hist.append(logdir)
            root_logdir_arg = root_logdir
            if len(set(logdir_hist)) > 1 and root_logdir == '':
                lumina.termwarn('When using several event log directories, please call `wandb.tensorboard.patch(root_logdir="...")` before `wandb.init`')
            hostname = socket.gethostname()
            search = re.search(f'-\\d+_{hostname}', logdir)
            if search:
                root_logdir_arg = logdir[:search.span()[1]]
            elif root_logdir is not None and (not os.path.abspath(logdir).startswith(os.path.abspath(root_logdir))):
                lumina.termwarn(f'Found log directory outside of given root_logdir, dropping given root_logdir for event file in {logdir}')
                root_logdir_arg = ''
            _notify_tensorboard_logdir(logdir, save=save, root_logdir=root_logdir_arg)
            super().__init__(logdir, *args, **kwargs)
    writer.orig_EventFileWriter = writer.EventFileWriter
    writer.EventFileWriter = TBXEventFileWriter
    lumina.patched['tensorboard'].append([module, 'EventFileWriter'])

def _notify_tensorboard_logdir(logdir: str, save: bool=True, root_logdir: str='') -> None:
    if lumina.run is not None:
        lumina.run._tensorboard_callback(logdir, save=save, root_logdir=root_logdir)
