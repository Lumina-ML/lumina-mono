"""Agent - Agent object.

Manage wandb agent.

"""
import ctypes
import logging
import os
import queue
import socket
import sys
import threading
import time
import traceback
from typing import Any
import lumina
from lumina.apis import InternalApi
from lumina.sdk.launch.sweeps import SweepNotFoundError
from lumina.sdk.launch.sweeps import utils as sweep_utils
from lumina.sdk.lib import config_util
logger = logging.getLogger(__name__)

def _terminate_thread(thread):
    if not thread.is_alive():
        return
    if hasattr(thread, '_terminated'):
        return
    thread._terminated = True
    tid = getattr(thread, '_thread_id', None)
    if tid is None:
        for k, v in threading._active.items():
            if v is thread:
                tid = k
    if tid is None:
        return
    logger.debug(f'Terminating thread: {tid}')
    res = ctypes.pythonapi.PyThreadState_SetAsyncExc(ctypes.c_long(tid), ctypes.py_object(Exception))
    if res == 0:
        return
    elif res != 1:
        logger.debug(f'Termination failed for thread {tid}')
        ctypes.pythonapi.PyThreadState_SetAsyncExc(ctypes.c_long(tid), None)

class Job:

    def __init__(self, command):
        self.command = command
        job_type = command.get('type')
        self.type = job_type
        self.run_id = command.get('run_id')
        self.config = command.get('args')

    def __repr__(self):
        if self.type == 'run':
            return f'Job({self.run_id},{self.config})'
        elif self.type == 'stop':
            return f'stop({self.run_id})'
        else:
            return 'exit'

class RunStatus:
    QUEUED = 'QUEUED'
    RUNNING = 'RUNNING'
    STOPPED = 'STOPPED'
    ERRORED = 'ERRORED'
    DONE = 'DONE'

class Agent:
    FLAPPING_MAX_SECONDS = 60
    FLAPPING_MAX_FAILURES = 3
    MAX_INITIAL_FAILURES = 5
    HEARTBEAT_SLEEP_SECONDS = 5

    def __init__(self, sweep_id=None, project=None, entity=None, function=None, count=None):
        self._sweep_path = sweep_id
        self._sweep_id = None
        self._project = project
        self._entity = entity
        self._function = function
        self._count = count
        self._api = InternalApi()
        self._api_lock = threading.Lock()
        self._agent_id = None
        self._max_initial_failures = lumina.env.get_agent_max_initial_failures(self.MAX_INITIAL_FAILURES)
        if os.environ.get(lumina.env.DIR) is None:
            os.environ[lumina.env.DIR] = os.path.abspath(os.getcwd())

    def _init(self):
        self._run_threads = {}
        self._run_status = {}
        self._queue = queue.Queue()
        self._exit_flag = False
        self._sweep_not_found = False
        self._exceptions = {}
        self._start_time = time.time()

    def _register(self):
        logger.debug('Agent._register()')
        agent = self._api.register_agent(socket.gethostname(), sweep_id=self._sweep_id)
        self._agent_id = agent['id']
        logger.debug(f'agent_id = {self._agent_id}')

    def _setup(self):
        logger.debug('Agent._setup()')
        self._init()
        parts = dict(entity=self._entity, project=self._project, name=self._sweep_path)
        err = sweep_utils.parse_sweep_id(parts)
        if err:
            lumina.termerror(err)
            return
        entity = parts.get('entity') or self._entity
        project = parts.get('project') or self._project
        sweep_id = parts.get('name') or self._sweep_id
        if sweep_id:
            os.environ[lumina.env.SWEEP_ID] = sweep_id
        if entity:
            lumina.env.set_entity(entity)
        if project:
            lumina.env.set_project(project)
        if sweep_id:
            self._sweep_id = sweep_id
        self._register()

    def _stop_run(self, run_id):
        logger.debug(f'Stopping run {run_id}.')
        self._run_status[run_id] = RunStatus.STOPPED
        thread = self._run_threads.get(run_id)
        if thread:
            _terminate_thread(thread)

    def _stop_all_runs(self):
        logger.debug('Stopping all runs.')
        for run in list(self._run_threads.keys()):
            self._stop_run(run)

    def _exit(self):
        self._stop_all_runs()
        self._exit_flag = True

    def _has_running_thread(self) -> bool:
        """True while an in-process trial thread is still running."""
        return any((t.is_alive() for t in self._run_threads.values()))

    def _heartbeat_commands(self, run_status: dict) -> list[dict[str, Any]]:
        """Fetch the next batch of agent commands from the server."""
        if self._sweep_not_found:
            return []
        try:
            with self._api_lock:
                return self._api.agent_heartbeat(self._agent_id, {}, run_status)
        except SweepNotFoundError:
            self._sweep_not_found = True
            if self._has_running_thread():
                lumina.termerror('Sweep was deleted or agent was not found. The in-process run will be allowed to finish before the agent exits.')
            return []

    def _stop_if_deleted_sweep_drained(self) -> bool:
        """Stop the agent once a deleted sweep has no in-process run left."""
        if not self._sweep_not_found or self._has_running_thread():
            return False
        lumina.termerror('Sweep was deleted or agent was not found. Stopping sweep.')
        self._exit_flag = True
        return True

    def _heartbeat(self):
        while True:
            if self._exit_flag:
                return
            run_status = {run: True for run, status in self._run_status.items() if status in (RunStatus.QUEUED, RunStatus.RUNNING)}
            commands = self._heartbeat_commands(run_status)
            if commands:
                job = Job(commands[0])
                logger.debug(f'Job received: {job}')
                if job.type in ['run', 'resume']:
                    self._queue.put(job)
                    self._run_status[job.run_id] = RunStatus.QUEUED
                elif job.type == 'stop':
                    self._stop_run(job.run_id)
                elif job.type == 'exit':
                    self._exit()
                    return
            if self._stop_if_deleted_sweep_drained():
                continue
            time.sleep(self.HEARTBEAT_SLEEP_SECONDS)

    def _run_jobs_from_queue(self):
        global _INSTANCES
        _INSTANCES += 1
        try:
            waiting = False
            count = 0
            while True:
                if self._exit_flag:
                    return
                try:
                    try:
                        job = self._queue.get(timeout=5)
                        if self._exit_flag:
                            logger.debug('Exiting main loop due to exit flag.')
                            lumina.termlog('Sweep Agent: Exiting.')
                            return
                    except queue.Empty:
                        if not waiting:
                            logger.debug('Paused.')
                            lumina.termlog('Sweep Agent: Waiting for job.')
                            waiting = True
                        time.sleep(5)
                        if self._exit_flag:
                            logger.debug('Exiting main loop due to exit flag.')
                            lumina.termlog('Sweep Agent: Exiting.')
                            return
                        continue
                    if waiting:
                        logger.debug('Resumed.')
                        lumina.termlog('Job received.')
                        waiting = False
                    count += 1
                    run_id = job.run_id
                    if self._run_status[run_id] == RunStatus.STOPPED:
                        continue
                    logger.debug(f'Spawning new thread for run {run_id}.')
                    thread = threading.Thread(target=self._run_job, args=(job,))
                    self._run_threads[run_id] = thread
                    thread.start()
                    self._run_status[run_id] = RunStatus.RUNNING
                    thread.join()
                    logger.debug(f'Thread joined for run {run_id}.')
                    if self._run_status[run_id] == RunStatus.RUNNING:
                        self._run_status[run_id] = RunStatus.DONE
                    elif self._run_status[run_id] == RunStatus.ERRORED:
                        exc = self._exceptions[run_id]
                        log_str, term_str = _get_exception_logger_and_term_strs(exc)
                        logger.error(f'Run {run_id} errored:\n{log_str}')
                        lumina.termerror(f'Run {run_id} errored:{term_str}')
                        if os.getenv(lumina.env.AGENT_DISABLE_FLAPPING) == 'true':
                            self._exit_flag = True
                            return
                        elif time.time() - self._start_time < self.FLAPPING_MAX_SECONDS and len(self._exceptions) >= self.FLAPPING_MAX_FAILURES:
                            msg = f'Detected {self.FLAPPING_MAX_FAILURES} failed runs in the first {self.FLAPPING_MAX_SECONDS} seconds, killing sweep.'
                            logger.error(msg)
                            lumina.termerror(msg)
                            lumina.termlog('To disable this check set WANDB_AGENT_DISABLE_FLAPPING=true')
                            self._exit_flag = True
                            return
                        if self._max_initial_failures < len(self._exceptions) and len(self._exceptions) >= count:
                            msg = f'Detected {self._max_initial_failures} failed runs in a row at start, killing sweep.'
                            logger.error(msg)
                            lumina.termerror(msg)
                            lumina.termlog('To change this value set WANDB_AGENT_MAX_INITIAL_FAILURES=val')
                            self._exit_flag = True
                            return
                    if self._count and self._count == count:
                        logger.debug('Exiting main loop because max count reached.')
                        self._exit_flag = True
                        return
                except KeyboardInterrupt:
                    logger.debug('Ctrl + C detected. Stopping sweep.')
                    lumina.termlog('Ctrl + C detected. Stopping sweep.')
                    self._exit()
                    return
                except Exception:
                    if self._exit_flag:
                        logger.debug('Exiting main loop due to exit flag.')
                        lumina.termlog('Sweep Agent: Killed.')
                        return
                    else:
                        raise
        finally:
            _INSTANCES -= 1

    def _run_job(self, job):
        try:
            run_id = job.run_id
            config_file = os.path.join('wandb', f'sweep-{self._sweep_id}', f'config-{run_id}.yaml')
            os.environ[lumina.env.RUN_ID] = run_id
            base_dir = os.environ.get(lumina.env.DIR, '')
            sweep_param_path = os.path.join(base_dir, config_file)
            os.environ[lumina.env.SWEEP_PARAM_PATH] = sweep_param_path
            config_util.save_config_file_from_dict(sweep_param_path, job.config)
            os.environ[lumina.env.SWEEP_ID] = self._sweep_id
            with self._api_lock:
                lumina.teardown()
                self._api = InternalApi()
            lumina.termlog(f'Agent Starting Run: {run_id} with config:')
            for k, v in job.config.items():
                lumina.termlog('\t{}: {}'.format(k, v['value']))
            try:
                self._function()
            except KeyboardInterrupt:
                raise
            except Exception as e:
                exc_repr = _format_exception_traceback(e)
                print(exc_repr, file=sys.stderr)
                raise _JobError(f'Run threw exception: {str(e)}') from e
            lumina.finish()
        except KeyboardInterrupt:
            raise
        except Exception as e:
            lumina.finish(exit_code=1)
            if self._run_status[run_id] == RunStatus.RUNNING:
                self._run_status[run_id] = RunStatus.ERRORED
                self._exceptions[run_id] = e
        finally:
            os.environ.pop(lumina.env.RUN_ID, None)
            os.environ.pop(lumina.env.SWEEP_ID, None)
            os.environ.pop(lumina.env.SWEEP_PARAM_PATH, None)

    def run(self):
        logger.info(f'Starting sweep agent: entity={self._entity}, project={self._project}, count={self._count}')
        self._setup()
        self._heartbeat_thread = threading.Thread(target=self._heartbeat)
        self._heartbeat_thread.daemon = True
        self._heartbeat_thread.start()
        self._run_jobs_from_queue()

def pyagent(sweep_id, function, entity=None, project=None, count=None):
    """Generic agent entrypoint, used for CLI or jupyter.

    Args:
        sweep_id (dict): Sweep ID generated by CLI or sweep API
        function (func, optional): A function to call instead of the "program"
        entity (str, optional): W&B Entity
        project (str, optional): W&B Project
        count (int, optional): the number of trials to run.
    """
    if not callable(function):
        raise TypeError('function parameter must be callable!')
    agent = Agent(sweep_id, function=function, entity=entity, project=project, count=count)
    agent.run()

def _format_exception_traceback(exc):
    return ''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))

class _JobError(Exception):
    """Exception raised when a job fails during execution."""
    pass

def _get_exception_logger_and_term_strs(exc):
    if isinstance(exc, _JobError) and exc.__cause__:
        job_exc = exc.__cause__
        log_str = _format_exception_traceback(job_exc)
        term_str = ' ' + str(job_exc)
    else:
        log_str = _format_exception_traceback(exc)
        term_str = '\n' + log_str
    return (log_str, term_str)
_INSTANCES = 0

def is_running():
    return bool(_INSTANCES)
