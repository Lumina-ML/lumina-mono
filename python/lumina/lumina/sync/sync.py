"""sync."""
from __future__ import annotations
import atexit
import datetime
import fnmatch
import os
import queue
import sys
import tempfile
import threading
import time
from urllib.parse import quote as url_quote

from lumina.backend.client import LuminaClient, LuminaClientError
from lumina.errors.term import termlog, termwarn
from lumina.proto import wandb_internal_pb2
from lumina.sdk.interface.interface_queue import InterfaceQueue
from lumina.sdk.internal import datastore, handler, sender, tb_watcher
from lumina.sdk.internal.settings_static import SettingsStatic
from lumina.sdk.lib import filesystem
from lumina.util import check_and_warn_old
WANDB_SUFFIX = '.wandb'
SYNCED_SUFFIX = '.synced'
TFEVENT_SUBSTRING = '.tfevents.'

class _LocalRun:

    def __init__(self, path, synced=None):
        self.path = path
        self.synced = synced
        self.offline = os.path.basename(path).startswith('offline-')
        self.datetime = datetime.datetime.strptime(os.path.basename(path).split('run-')[1].split('-')[0], '%Y%m%d_%H%M%S')

    def __str__(self):
        return self.path

class SyncThread(threading.Thread):

    def __init__(self, sync_list, project=None, entity=None, run_id=None, job_type=None, view=None, verbose=None, mark_synced=None, app_url=None, sync_tensorboard=None, log_path=None, append=None, skip_console=None, replace_tags=None):
        threading.Thread.__init__(self)
        self._sync_list = sync_list
        self._project = project
        self._entity = entity
        self._run_id = run_id
        self._job_type = job_type
        self._view = view
        self._verbose = verbose
        self._mark_synced = mark_synced
        self._app_url = app_url
        self._sync_tensorboard = sync_tensorboard
        self._log_path = log_path
        self._append = append
        self._skip_console = skip_console
        self._replace_tags = replace_tags or {}
        self._tmp_dir = tempfile.TemporaryDirectory()
        atexit.register(self._tmp_dir.cleanup)

    def _parse_pb(self, data, exit_pb=None):
        pb = wandb_internal_pb2.Record()
        pb.ParseFromString(data)
        record_type = pb.WhichOneof('record_type')
        if self._view:
            if self._verbose:
                print('Record:', pb)
            else:
                print('Record:', record_type)
            return (pb, exit_pb, True)
        if record_type == 'run':
            if self._run_id:
                pb.run.run_id = self._run_id
            if self._project:
                pb.run.project = self._project
            if self._entity:
                pb.run.entity = self._entity
            if self._job_type:
                pb.run.job_type = self._job_type
            if self._replace_tags:
                new_tags = [self._replace_tags.get(tag, tag) for tag in pb.run.tags]
                pb.run.ClearField('tags')
                pb.run.tags.extend(new_tags)
            pb.control.req_resp = True
        elif record_type in ('output', 'output_raw') and self._skip_console:
            return (pb, exit_pb, True)
        elif record_type == 'exit':
            exit_pb = pb
            return (pb, exit_pb, True)
        elif record_type == 'final':
            assert exit_pb, 'final seen without exit'
            pb = exit_pb
            exit_pb = None
        return (pb, exit_pb, False)

    def _find_tfevent_files(self, sync_item):
        tb_event_files = 0
        tb_logdirs = []
        tb_root = None
        if self._sync_tensorboard:
            if os.path.isdir(sync_item):
                files = []
                for dirpath, _, _files in os.walk(sync_item):
                    for f in _files:
                        if TFEVENT_SUBSTRING in f:
                            files.append(os.path.join(dirpath, f))
                for tfevent in files:
                    tb_event_files += 1
                    tb_dir = os.path.dirname(os.path.abspath(tfevent))
                    if tb_dir not in tb_logdirs:
                        tb_logdirs.append(tb_dir)
                if len(tb_logdirs) > 0:
                    tb_root = os.path.dirname(os.path.commonprefix(tb_logdirs))
            elif TFEVENT_SUBSTRING in sync_item:
                tb_root = os.path.dirname(os.path.abspath(sync_item))
                tb_logdirs.append(tb_root)
                tb_event_files = 1
        return (tb_event_files, tb_logdirs, tb_root)

    def _setup_tensorboard(self, tb_root, tb_logdirs, tb_event_files, sync_item):
        """Return true if this sync item can be synced as tensorboard."""
        if tb_root is not None:
            if tb_event_files > 0 and sync_item.endswith(WANDB_SUFFIX):
                termwarn('Found .wandb file, not streaming tensorboard metrics.')
            else:
                print(f'Found {tb_event_files} tfevent files in {tb_root}')
                if len(tb_logdirs) > 3:
                    termwarn(f'Found {len(tb_logdirs)} directories containing tfevent files. If these represent multiple experiments, sync them individually or pass a list of paths.')
                return True
        return False

    def _send_tensorboard(self, tb_root, tb_logdirs, send_manager):
        if self._entity is None:
            try:
                viewer = send_manager._client.get_current_user()
                self._entity = viewer.get("entity") or viewer.get("id")
            except LuminaClientError as exc:
                termwarn(f"could not fetch current user for entity: {exc}")
                self._entity = None
        proto_run = wandb_internal_pb2.RunRecord()
        proto_run.run_id = self._run_id or _generate_id()
        proto_run.project = self._project or _auto_project_name(None)
        proto_run.entity = self._entity
        proto_run.telemetry.feature.sync_tfevents = True
        url = f'{self._app_url}/{url_quote(proto_run.entity or "")}/{url_quote(proto_run.project)}/runs/{url_quote(proto_run.run_id)}'
        print(f'Syncing: {url} ...')
        sys.stdout.flush()
        record_q = queue.Queue()
        sender_record_q = queue.Queue()
        new_interface = InterfaceQueue(record_q)
        # Reuse the parent send_manager's LuminaClient so sync reuses
        # the same env-derived base_url / api_key.
        send_manager = sender.SendManager(
            settings=send_manager._settings,
            record_q=sender_record_q,
            result_q=queue.Queue(),
            interface=new_interface,
            client=send_manager._client,
        )
        # Inline the proto Record so we don't pull in `import lumina`
        # (which still triggers the agents-bug chain on the branch).
        record = wandb_internal_pb2.Record(run=proto_run)
        record.control.req_resp = True
        settings = _build_settings(root_dir=self._tmp_dir.name, run_id=proto_run.run_id, start_time=time.time())
        settings_static = SettingsStatic(dict(settings))
        handle_manager = handler.HandleManager(settings=settings_static, record_q=record_q, result_q=None, stopped=False, writer_q=sender_record_q, interface=new_interface)
        filesystem.mkdir_exists_ok(settings.files_dir)
        send_manager.send_run(record, file_dir=settings.files_dir)
        watcher = tb_watcher.TBWatcher(settings_static, proto_run, new_interface, True)
        for tb in tb_logdirs:
            watcher.add(tb, True, tb_root)
            sys.stdout.flush()
        watcher.finish()
        progress_step = 0
        spinner_states = ['-', '\\', '|', '/']
        line = ' Uploading data to wandb\r'
        while len(handle_manager) > 0:
            data = next(handle_manager)
            handle_manager.handle(data)
            while len(send_manager) > 0:
                data = next(send_manager)
                send_manager.send(data)
            print_line = spinner_states[progress_step % 4] + line
            termlog(print_line, newline=False, prefix=True)
            progress_step += 1
        while len(send_manager) > 0:
            data = next(send_manager)
            send_manager.send(data)
        sys.stdout.flush()
        handle_manager.finish()
        send_manager.finish()

    def _robust_scan(self, ds):
        """Attempt to scan data, handling incomplete files."""
        try:
            return ds.scan_data()
        except AssertionError as e:
            if ds.in_last_block():
                termwarn(f".wandb file is incomplete ({e}), be sure to sync this run again once it's finished")
                return None
            else:
                raise

    def run(self):
        if self._log_path is not None:
            print(f'Find logs at: {self._log_path}')
        for sync_item in self._sync_list:
            tb_event_files, tb_logdirs, tb_root = self._find_tfevent_files(sync_item)
            if os.path.isdir(sync_item):
                files = os.listdir(sync_item)
                filtered_files = list(filter(lambda f: f.endswith(WANDB_SUFFIX), files))
                if tb_root is None and (check_and_warn_old(files) or len(filtered_files) != 1):
                    print(f'Skipping directory: {sync_item}')
                    continue
                if len(filtered_files) > 0:
                    sync_item = os.path.join(sync_item, filtered_files[0])
            sync_tb = self._setup_tensorboard(tb_root, tb_logdirs, tb_event_files, sync_item)
            root_dir = self._tmp_dir.name if sync_tb else os.path.dirname(sync_item)
            resume = 'allow' if self._append else None
            # Honor env-derived base_url so `LUMINA_API_URL` controls
            # the sync destination.
            sm = sender.SendManager.setup(
                root_dir,
                resume=resume,
                base_url=os.getenv("LUMINA_API_URL"),
                api_key=os.getenv("LUMINA_API_KEY"),
            )
            if sync_tb:
                self._send_tensorboard(tb_root, tb_logdirs, sm)
                continue
            ds = datastore.DataStore()
            try:
                ds.open_for_scan(sync_item)
            except AssertionError as e:
                print(f'.wandb file is empty ({e}), skipping: {sync_item}')
                continue
            exit_pb = None
            finished = False
            shown = False
            while True:
                data = self._robust_scan(ds)
                if data is None:
                    break
                pb, exit_pb, cont = self._parse_pb(data, exit_pb)
                if exit_pb is not None:
                    finished = True
                if cont:
                    continue
                sm.send(pb)
                while not sm._record_q.empty():
                    data = sm._record_q.get(block=True)
                    sm.send(data)
                if pb.control.req_resp:
                    result = sm._result_q.get(block=True)
                    result_type = result.WhichOneof('result_type')
                    if not shown and result_type == 'run_result':
                        r = result.run_result.run
                        url = f'{self._app_url}/{url_quote(r.entity)}/{url_quote(r.project)}/runs/{url_quote(r.run_id)}'
                        print(f'Syncing: {url} ... ', end='')
                        sys.stdout.flush()
                        shown = True
            sm.finish()
            if self._mark_synced and (not self._view) and finished:
                synced_file = f'{sync_item}{SYNCED_SUFFIX}'
                with open(synced_file, 'w'):
                    pass
            print('done.')

class SyncManager:

    def __init__(self, project=None, entity=None, run_id=None, job_type=None, mark_synced=None, app_url=None, view=None, verbose=None, sync_tensorboard=None, log_path=None, append=None, skip_console=None, replace_tags=None):
        self._sync_list = []
        self._thread = None
        self._project = project
        self._entity = entity
        self._run_id = run_id
        self._job_type = job_type
        self._mark_synced = mark_synced
        self._app_url = app_url
        self._view = view
        self._verbose = verbose
        self._sync_tensorboard = sync_tensorboard
        self._log_path = log_path
        self._append = append
        self._skip_console = skip_console
        self._replace_tags = replace_tags or {}

    def status(self):
        pass

    def add(self, p):
        self._sync_list.append(os.path.abspath(str(p)))

    def start(self):
        self._thread = SyncThread(sync_list=self._sync_list, project=self._project, entity=self._entity, run_id=self._run_id, job_type=self._job_type, view=self._view, verbose=self._verbose, mark_synced=self._mark_synced, app_url=self._app_url, sync_tensorboard=self._sync_tensorboard, log_path=self._log_path, append=self._append, skip_console=self._skip_console, replace_tags=self._replace_tags)
        self._thread.start()

    def is_done(self):
        return not self._thread.is_alive()

    def poll(self):
        time.sleep(1)
        return False

def get_runs(include_offline: bool=True, include_online: bool=True, include_synced: bool=False, include_unsynced: bool=True, exclude_globs: list[str] | None=None, include_globs: list[str] | None=None):
    base = '.wandb' if os.path.exists('.wandb') else 'wandb'
    if not os.path.exists(base):
        return ()
    all_dirs = os.listdir(base)
    dirs = []
    if include_offline:
        dirs += filter(lambda _d: _d.startswith('offline-run-'), all_dirs)
    if include_online:
        dirs += filter(lambda _d: _d.startswith('run-'), all_dirs)
    fnames = []
    dirs.sort()
    for d in dirs:
        paths = os.listdir(os.path.join(base, d))
        if exclude_globs:
            paths = set(paths)
            for g in exclude_globs:
                paths = paths - set(fnmatch.filter(paths, g))
            paths = list(paths)
        if include_globs:
            new_paths = set()
            for g in include_globs:
                new_paths = new_paths.union(fnmatch.filter(paths, g))
            paths = list(new_paths)
        for f in paths:
            if f.endswith(WANDB_SUFFIX):
                fnames.append(os.path.join(base, d, f))
    filtered = []
    for f in fnames:
        dname = os.path.dirname(f)
        if os.path.exists(f'{f}{SYNCED_SUFFIX}') or os.path.basename(dname).startswith('run-'):
            if include_synced:
                filtered.append(_LocalRun(dname, True))
        elif include_unsynced:
            filtered.append(_LocalRun(dname, False))
    return tuple(filtered)

def get_run_from_path(path):
    return _LocalRun(path)


# ---------------------------------------------------------------------------
# Leaf-level helpers — avoid `import lumina` here so the file stays loadable
# even when the pre-existing `lumina/agents/agent.py:19` bug is unfixed.
# ---------------------------------------------------------------------------

def _generate_id() -> str:
    """Standalone replacement for `lumina.util.generate_id`. UUID v7."""
    import uuid
    return str(uuid.uuid4())


def _auto_project_name(_program: str | None) -> str:
    """Standalone replacement for `lumina.util.auto_project_name`."""
    return "uncategorized"


def _build_settings(*, root_dir: str, run_id: str, start_time: float) -> Any:
    """Standalone replacement for `lumina.Settings(...)` for sync's needs.

    Returns an object with at least the attributes the rest of sync
    reads (`files_dir`, `program`, `start_time`, ...).
    """
    settings = SettingsStatic({
        "root_dir": root_dir,
        "run_id": run_id,
        "x_start_time": start_time,
        "x_files_dir": os.path.join(root_dir, "files"),
        "x_sync": True,
    })
    settings.files_dir = os.path.join(root_dir, "files")
    return settings
