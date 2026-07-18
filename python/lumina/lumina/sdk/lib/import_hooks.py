"""Implements a post-import hook mechanism.

Styled as per PEP-369. Note that it doesn't cope with modules being reloaded.

Note: This file is based on
https://github.com/GrahamDumpleton/wrapt/blob/1.12.1/src/wrapt/importer.py
and manual backports of later patches up to 1.15.0 in the wrapt repository
(with slight modifications).
"""
from __future__ import annotations
import sys
import threading
from collections.abc import Callable
from importlib.util import find_spec
from typing import Any
_post_import_hooks: dict = {}
_post_import_hooks_init: bool = False
_post_import_hooks_lock = threading.RLock()

def _create_import_hook_from_string(name: str) -> Callable:

    def import_hook(module: Any) -> Callable:
        module_name, function = name.split(':')
        attrs = function.split('.')
        __import__(module_name)
        callback = sys.modules[module_name]
        for attr in attrs:
            callback = getattr(callback, attr)
        return callback(module)
    return import_hook

def register_post_import_hook(hook: str | Callable, hook_id: str, name: str) -> None:
    if isinstance(hook, (str,)):
        hook = _create_import_hook_from_string(hook)
    with _post_import_hooks_lock:
        global _post_import_hooks_init
        if not _post_import_hooks_init:
            _post_import_hooks_init = True
            sys.meta_path.insert(0, ImportHookFinder())
        module = sys.modules.get(name, None)
        if module is None:
            _post_import_hooks.setdefault(name, {}).update({hook_id: hook})
    if module is not None:
        hook(module)

def unregister_post_import_hook(name: str, hook_id: str | None) -> None:
    with _post_import_hooks_lock:
        hooks = _post_import_hooks.get(name)
        if hooks is not None:
            if hook_id is not None:
                hooks.pop(hook_id, None)
                if not hooks:
                    del _post_import_hooks[name]
            else:
                del _post_import_hooks[name]

def unregister_all_post_import_hooks() -> None:
    with _post_import_hooks_lock:
        _post_import_hooks.clear()

def notify_module_loaded(module: Any) -> None:
    name = getattr(module, '__name__', None)
    with _post_import_hooks_lock:
        hooks = _post_import_hooks.pop(name, {})
    for hook in hooks.values():
        if hook:
            hook(module)

class _ImportHookChainedLoader:

    def __init__(self, loader: Any) -> None:
        self.loader = loader
        if hasattr(loader, 'load_module'):
            self.load_module = self._load_module
        if hasattr(loader, 'create_module'):
            self.create_module = self._create_module
        if hasattr(loader, 'exec_module'):
            self.exec_module = self._exec_module

    def _set_loader(self, module: Any) -> None:

        class UNDEFINED:
            pass
        if getattr(module, '__loader__', UNDEFINED) in (None, self):
            try:
                module.__loader__ = self.loader
            except AttributeError:
                pass
        if getattr(module, '__spec__', None) is not None and getattr(module.__spec__, 'loader', None) is self:
            module.__spec__.loader = self.loader

    def _load_module(self, fullname: str) -> Any:
        module = self.loader.load_module(fullname)
        self._set_loader(module)
        notify_module_loaded(module)
        return module

    def _create_module(self, spec: Any) -> Any:
        return self.loader.create_module(spec)

    def _exec_module(self, module: Any) -> None:
        self._set_loader(module)
        self.loader.exec_module(module)
        notify_module_loaded(module)

class ImportHookFinder:

    def __init__(self) -> None:
        self.in_progress: dict = {}

    def find_module(self, fullname: str, path: str | None=None) -> _ImportHookChainedLoader | None:
        with _post_import_hooks_lock:
            if fullname not in _post_import_hooks:
                return None
        if fullname in self.in_progress:
            return None
        self.in_progress[fullname] = True
        try:
            loader = getattr(find_spec(fullname), 'loader', None)
            if loader and (not isinstance(loader, _ImportHookChainedLoader)):
                return _ImportHookChainedLoader(loader)
        finally:
            del self.in_progress[fullname]

    def find_spec(self, fullname: str, path: str | None=None, target: Any=None) -> Any:
        with _post_import_hooks_lock:
            if fullname not in _post_import_hooks:
                return None
        if fullname in self.in_progress:
            return None
        self.in_progress[fullname] = True
        try:
            spec = find_spec(fullname)
            loader = getattr(spec, 'loader', None)
            if loader and (not isinstance(loader, _ImportHookChainedLoader)):
                assert spec is not None
                spec.loader = _ImportHookChainedLoader(loader)
            return spec
        finally:
            del self.in_progress[fullname]
