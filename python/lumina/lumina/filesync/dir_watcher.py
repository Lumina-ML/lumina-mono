from __future__ import annotations
import abc
import fnmatch
import glob
import logging
import os
import queue
import time
from collections.abc import Mapping, MutableMapping, MutableSet
from typing import TYPE_CHECKING, Any
from lumina import util
from lumina.sdk.lib.filesystem import GlobStr
from lumina.sdk.lib.paths import LogicalPath
if TYPE_CHECKING:
    import lumina.vendor.watchdog_0_9_0.observers.api as wd_api
    import lumina.vendor.watchdog_0_9_0.observers.polling as wd_polling
    import lumina.vendor.watchdog_0_9_0.watchdog.events as wd_events
    from lumina.sdk.internal.file_pusher import FilePusher
    from lumina.sdk.internal.settings_static import SettingsStatic
    from lumina.sdk.lib.filesystem import PolicyName
else:
    wd_polling = util.vendor_import('wandb_watchdog.observers.polling')
    wd_events = util.vendor_import('wandb_watchdog.events')
PathStr = str
logger = logging.getLogger(__name__)

class FileEventHandler(abc.ABC):

    def __init__(self, file_path: PathStr, save_name: LogicalPath, file_pusher: FilePusher, *args: Any, **kwargs: Any) -> None:
        self.file_path = file_path
        self.save_name = LogicalPath(save_name)
        self._file_pusher = file_pusher
        self._last_sync: float | None = None

    @property
    @abc.abstractmethod
    def policy(self) -> PolicyName:
        raise NotImplementedError

    @abc.abstractmethod
    def on_modified(self, force: bool=False) -> None:
        raise NotImplementedError

    @abc.abstractmethod
    def finish(self) -> None:
        raise NotImplementedError

    def on_renamed(self, new_path: PathStr, new_name: LogicalPath) -> None:
        self.file_path = new_path
        self.save_name = new_name
        self.on_modified()

class PolicyNow(FileEventHandler):
    """This policy only uploads files now."""

    def on_modified(self, force: bool=False) -> None:
        if self._last_sync is None or force:
            self._file_pusher.file_changed(self.save_name, self.file_path)
            self._last_sync = os.path.getmtime(self.file_path)

    def finish(self) -> None:
        pass

    @property
    def policy(self) -> PolicyName:
        return 'now'

class PolicyEnd(FileEventHandler):
    """This policy only updates at the end of the run."""

    def on_modified(self, force: bool=False) -> None:
        pass

    def finish(self) -> None:
        self._last_sync = os.path.getmtime(self.file_path)
        self._file_pusher.file_changed(self.save_name, self.file_path, copy=False)

    @property
    def policy(self) -> PolicyName:
        return 'end'

class PolicyLive(FileEventHandler):
    """Event handler that uploads respecting throttling.

    Uploads files every RATE_LIMIT_SECONDS, which changes as the size increases to deal
    with throttling.
    """
    RATE_LIMIT_SECONDS = 15
    unit_dict = dict(util.POW_10_BYTES)
    RATE_LIMIT_SIZE_INCREASE = 1.2

    def __init__(self, file_path: PathStr, save_name: LogicalPath, file_pusher: FilePusher, settings: SettingsStatic | None=None, *args: Any, **kwargs: Any) -> None:
        super().__init__(file_path, save_name, file_pusher, *args, **kwargs)
        self._last_uploaded_time: float | None = None
        self._last_uploaded_size: int = 0
        if settings is not None:
            if settings.x_live_policy_rate_limit is not None:
                self.RATE_LIMIT_SECONDS = settings.x_live_policy_rate_limit
            self._min_wait_time: float | None = settings.x_live_policy_wait_time
        else:
            self._min_wait_time = None

    @property
    def current_size(self) -> int:
        return os.path.getsize(self.file_path)

    @classmethod
    def min_wait_for_size(cls, size: int) -> float:
        if size < 10 * cls.unit_dict['MB']:
            return 60
        elif size < 100 * cls.unit_dict['MB']:
            return 5 * 60
        elif size < cls.unit_dict['GB']:
            return 10 * 60
        else:
            return 20 * 60

    def should_update(self) -> bool:
        if self._last_uploaded_time is not None:
            time_elapsed = time.time() - self._last_uploaded_time
            if time_elapsed < self.RATE_LIMIT_SECONDS:
                return False
            if float(self._last_uploaded_size) > 0:
                size_increase = self.current_size / float(self._last_uploaded_size)
                if size_increase < self.RATE_LIMIT_SIZE_INCREASE:
                    return False
            return time_elapsed > (self._min_wait_time or self.min_wait_for_size(self.current_size))
        return True

    def on_modified(self, force: bool=False) -> None:
        if self.current_size == 0:
            return
        if self._last_sync == os.path.getmtime(self.file_path):
            return
        if force or self.should_update():
            self.save_file()

    def save_file(self) -> None:
        self._last_sync = os.path.getmtime(self.file_path)
        self._last_uploaded_time = time.time()
        self._last_uploaded_size = self.current_size
        self._file_pusher.file_changed(self.save_name, self.file_path)

    def finish(self) -> None:
        self.on_modified(force=True)

    @property
    def policy(self) -> PolicyName:
        return 'live'

class DirWatcher:

    def __init__(self, settings: SettingsStatic, file_pusher: FilePusher, file_dir: PathStr | None=None) -> None:
        self._file_count = 0
        self._dir = file_dir or settings.files_dir
        self._settings = settings
        self._savename_file_policies: MutableMapping[LogicalPath, PolicyName] = {}
        self._user_file_policies: Mapping[PolicyName, MutableSet[GlobStr]] = {'end': set(), 'live': set(), 'now': set()}
        self._file_pusher = file_pusher
        self._file_event_handlers: MutableMapping[LogicalPath, FileEventHandler] = {}
        self._file_observer = wd_polling.PollingObserver()
        self._file_observer.schedule(self._per_file_event_handler(), self._dir, recursive=True)
        self._file_observer.start()
        logger.info('watching files in: %s', settings.files_dir)

    @property
    def emitter(self) -> wd_api.EventEmitter | None:
        try:
            return next(iter(self._file_observer.emitters))
        except StopIteration:
            return None

    def update_policy(self, path: GlobStr, policy: PolicyName) -> None:
        save_name = LogicalPath(os.path.relpath(os.path.join(self._dir, path), self._dir))
        if save_name.startswith('media/'):
            pass
        elif path == glob.escape(path):
            self._savename_file_policies[save_name] = policy
        else:
            self._user_file_policies[policy].add(path)
        for src_path in glob.glob(os.path.join(self._dir, path)):
            save_name = LogicalPath(os.path.relpath(src_path, self._dir))
            feh = self._get_file_event_handler(src_path, save_name)
            if feh.policy != policy:
                try:
                    del self._file_event_handlers[save_name]
                except KeyError:
                    pass
                feh = self._get_file_event_handler(src_path, save_name)
            feh.on_modified(force=True)

    def _per_file_event_handler(self) -> wd_events.FileSystemEventHandler:
        """Create a Watchdog file event handler that does different things for every file."""
        file_event_handler = wd_events.PatternMatchingEventHandler()
        file_event_handler.on_created = self._on_file_created
        file_event_handler.on_modified = self._on_file_modified
        file_event_handler.on_moved = self._on_file_moved
        file_event_handler._patterns = [os.path.join(self._dir, os.path.normpath('*'))]
        file_event_handler._ignore_patterns = ['*.tmp', '*.wandb', 'wandb-summary.json', os.path.join(self._dir, '.*'), os.path.join(self._dir, '*/.*')]
        for glb in self._settings.ignore_globs:
            file_event_handler._ignore_patterns.append(os.path.join(self._dir, glb))
        return file_event_handler

    def _on_file_created(self, event: wd_events.FileCreatedEvent) -> None:
        logger.info('file/dir created: %s', event.src_path)
        if os.path.isdir(event.src_path):
            return None
        self._file_count += 1
        if self._file_count % 100 == 0:
            emitter = self.emitter
            if emitter:
                emitter._timeout = int(self._file_count / 100) + 1
        save_name = LogicalPath(os.path.relpath(event.src_path, self._dir))
        self._get_file_event_handler(event.src_path, save_name).on_modified()

    def _on_file_modified(self, event: wd_events.FileModifiedEvent) -> None:
        logger.info(f'file/dir modified: {event.src_path}')
        if os.path.isdir(event.src_path):
            return None
        save_name = LogicalPath(os.path.relpath(event.src_path, self._dir))
        self._get_file_event_handler(event.src_path, save_name).on_modified()

    def _on_file_moved(self, event: wd_events.FileMovedEvent) -> None:
        logger.info(f'file/dir moved: {event.src_path} -> {event.dest_path}')
        if os.path.isdir(event.dest_path):
            return None
        old_save_name = LogicalPath(os.path.relpath(event.src_path, self._dir))
        new_save_name = LogicalPath(os.path.relpath(event.dest_path, self._dir))
        handler = self._get_file_event_handler(event.src_path, old_save_name)
        self._file_event_handlers[new_save_name] = handler
        del self._file_event_handlers[old_save_name]
        handler.on_renamed(event.dest_path, new_save_name)

    def _get_file_event_handler(self, file_path: PathStr, save_name: LogicalPath) -> FileEventHandler:
        """Get or create an event handler for a particular file.

        file_path: the file's actual path
        save_name: its path relative to the run directory (aka the watch directory)
        """
        if save_name.startswith('media/'):
            return PolicyNow(file_path, save_name, self._file_pusher, self._settings)
        if save_name not in self._file_event_handlers:
            if 'tfevents' in save_name or 'graph.pbtxt' in save_name:
                self._file_event_handlers[save_name] = PolicyLive(file_path, save_name, self._file_pusher, self._settings)
            elif save_name in self._savename_file_policies:
                policy_name = self._savename_file_policies[save_name]
                make_handler = PolicyLive if policy_name == 'live' else PolicyNow if policy_name == 'now' else PolicyEnd
                self._file_event_handlers[save_name] = make_handler(file_path, save_name, self._file_pusher, self._settings)
            else:
                make_handler = PolicyEnd
                for policy, globs in self._user_file_policies.items():
                    if policy == 'end':
                        continue
                    for g in list(globs):
                        paths = glob.glob(os.path.join(self._dir, g))
                        if any((save_name in p for p in paths)):
                            if policy == 'live':
                                make_handler = PolicyLive
                            elif policy == 'now':
                                make_handler = PolicyNow
                self._file_event_handlers[save_name] = make_handler(file_path, save_name, self._file_pusher, self._settings)
        return self._file_event_handlers[save_name]

    def finish(self) -> None:
        logger.info('shutting down directory watcher')
        try:
            if self._file_observer.is_alive():
                self._file_observer._timeout = 0
                self._file_observer._stopped_event.set()
                self._file_observer.join()
                self.emitter.queue_events(0)
                while True:
                    try:
                        self._file_observer.dispatch_events(self._file_observer.event_queue, 0)
                    except queue.Empty:
                        break
                self._file_observer.stop()
        except TypeError:
            pass
        except SystemError:
            pass
        logger.info('scan: %s', self._dir)
        for dirpath, _, filenames in os.walk(self._dir):
            for fname in filenames:
                file_path = os.path.join(dirpath, fname)
                save_name = LogicalPath(os.path.relpath(file_path, self._dir))
                ignored = False
                for glb in self._settings.ignore_globs:
                    if len(fnmatch.filter([save_name], glb)) > 0:
                        ignored = True
                        logger.info('ignored: %s matching glob %s', save_name, glb)
                        break
                if ignored:
                    continue
                logger.info('scan save: %s %s', file_path, save_name)
                self._get_file_event_handler(file_path, save_name).finish()
