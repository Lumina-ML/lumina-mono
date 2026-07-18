from __future__ import annotations
import json
import logging
import os
import pathlib
import platform
import re
import shutil
import socket
import sys
import traceback
from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Any, Literal
from urllib.parse import quote, unquote
from google.protobuf.wrappers_pb2 import BoolValue, DoubleValue, Int32Value, StringValue
from pydantic import BaseModel, ConfigDict, Field
from typing_extensions import Self
import lumina
from lumina import env, util
from lumina._pydantic import AliasChoices, ValidationError, computed_field, field_validator, model_validator
from lumina.errors import UsageError
from lumina.proto import wandb_settings_pb2
from lumina.sdk.lib import deprecation, settings_file, urls
from .lib import credentials, filesystem, ipython
from .lib.run_moment import RunMoment

def _path_convert(*args: str) -> str:
    """Join path and apply os.path.expanduser to it."""
    return os.path.expanduser(os.path.join(*args))
CLIENT_ONLY_SETTINGS = ('anonymous', 'app_url_override', 'capture_loggers', 'files_dir', 'finish_timeout_raises', 'max_end_of_run_history_metrics', 'max_end_of_run_summary_metrics', 'reinit', 'stop_fn', 'x_files_dir', 'x_sync_dir_suffix')
'Python-only keys that are not fields on the settings proto.'

class Settings(BaseModel, validate_assignment=True):
    """Settings for the W&B SDK.

    This class manages configuration settings for the W&B SDK,
    ensuring type safety and validation of all settings. Settings are accessible
    as attributes and can be initialized programmatically, through environment
    variables (`WANDB_ prefix`), and with configuration files.

    The settings are organized into three categories:
    1. Public settings: Core configuration options that users can safely modify to customize
       W&B's behavior for their specific needs.
    2. Internal settings: Settings prefixed with 'x_' that handle low-level SDK behavior.
       These settings are primarily for internal use and debugging. While they can be modified,
       they are not considered part of the public API and may change without notice in future
       versions.
    3. Computed settings: Read-only settings that are automatically derived from other settings or
       the environment.

    Settings are loaded from multiple sources. When the same setting is supplied
    by more than one source, the source listed later wins. From lowest to highest
    precedence:

    1. Default values defined on this `Settings` model.
    2. Configuration files (`~/.config/wandb/settings`, or the `settings` file in
       the directory named by the `WANDB_CONFIG_DIR` environment variable).
    3. Environment variables (those prefixed with `WANDB_`, e.g. `WANDB_MODE`).
    4. Values detected from the runtime environment, such as the hostname, the
       running program/script path, the Python executable, the Docker image, and
       Jupyter notebook details.
    5. SageMaker settings, when running in an Amazon SageMaker environment.
    6. The `settings` parameter of `wandb.setup()`.
    7. The `settings` parameter of `wandb.init()`.
    8. Certain `wandb.init()` parameters (for example, `mode=` overrides the
       `mode` setting).
    """
    model_config = ConfigDict(extra='forbid', validate_default=True, use_attribute_docstrings=True, revalidate_instances='always')
    allow_media_symlink: bool = False
    'Whether to symlink media files to the run directory.\n\n    If true, media files will be symlinked or hardlinked to the\n    run directory instead of copied. This may result in faster\n    logging and reduced disk usage. However, deleting or modifying\n    the original files before upload to the W&B server will be\n    reflected in the uploaded data.\n    '
    allow_offline_artifacts: bool = True
    'Flag to allow table artifacts to be synced in offline mode.\n\n    To revert to the old behavior, set this to False.\n    '
    allow_val_change: bool = False
    "Flag to allow modification of `Config` values after they've been set."
    anonymous: deprecation.DoNotSet = Field(default=deprecation.UNSET, exclude=True)
    'Deprecated and will be removed.'
    api_key: str | None = None
    'The W&B API key.'
    azure_account_url_to_access_key: dict[str, str] | None = None
    'Mapping of Azure account URLs to their corresponding access keys for Azure integration.'
    app_url_override: str | None = None
    "Override for the 'app' URL for the W&B UI.\n\n    The `app_url` is normally computed based on `base_url`, but this can be\n    used to set it explicitly.\n\n    WANDB_APP_URL is the corresponding environment variable.\n    "
    base_url: str = 'https://api.wandb.ai'
    'The URL of the W&B backend for data synchronization.'
    code_dir: str | None = None
    'Directory containing the code to be tracked by W&B.'
    config_paths: Sequence[str] | None = None
    'Paths to files to load configuration from into the `Config` object.'
    console: Literal['auto', 'off', 'wrap', 'redirect', 'wrap_raw', 'wrap_emu'] = Field(default='auto', validate_default=True)
    'The type of console capture to be applied.\n\n    Possible values are:\n    - "auto" - Automatically selects the console capture method based on the\n      system environment and settings.\n    - "off" - Disables console capture.\n    - "redirect" - Redirects low-level file descriptors for capturing output.\n    - "wrap" - Overrides the write methods of sys.stdout/sys.stderr. Will be\n      mapped to either "wrap_raw" or "wrap_emu" based on the state of the system.\n    - "wrap_raw" - Same as "wrap" but captures raw output directly instead of\n      through an emulator. Derived from the `wrap` setting and should not be set manually.\n    - "wrap_emu" - Same as "wrap" but captures output through an emulator.\n      Derived from the `wrap` setting and should not be set manually.\n    '
    console_multipart: bool = False
    'Enable multipart console logging.\n\n    When True, the SDK writes console output to timestamped files\n    under the `logs/` directory instead of a single `output.log`.\n\n    Each part is uploaded as soon as it is closed, giving users live\n    access to logs while the run is active. Rollover cadence is\n    controlled by `console_chunk_max_bytes` and/or `console_chunk_max_seconds`.\n    If both limits are `0`, all logs are uploaded once at run finish.\n\n    Note: Uploaded chunks are immutable; terminal control sequences\n    that modify previous lines (e.g., progress bars using carriage returns)\n    only affect the current chunk.\n    '
    console_chunk_max_bytes: int = 0
    'Size-based rollover threshold for multipart console logs, in bytes.\n\n    Starts a new console log file when the current part reaches this\n    size. Has an effect only when `console_multipart` is `True`.\n    Can be combined with `console_chunk_max_seconds`; whichever limit is\n    hit first triggers the rollover. A value of `0` disables the\n    size-based limit.\n    '
    console_chunk_max_seconds: int = 0
    'Time-based rollover threshold for multipart console logs, in seconds.\n\n    Starts a new console log file after this many seconds have elapsed\n    since the current part began. Requires `console_multipart` to be\n    `True`.  May be used with `console_chunk_max_bytes`; the first limit\n    reached closes the part. A value of `0` disables the time-based\n    limit.\n    '
    capture_loggers: dict[str, str] | None = None
    'Names of Python loggers to capture into the run\'s Logs tab.\n\n    A mapping of logger name to minimum log level. When set, wandb installs a\n    logging.Handler on each named logger and removes it when the run finishes.\n    Log records emitted by those loggers are published as console output to the\n    run, similar to stdout/stderr capture.\n\n    Log records are formatted the same as `logging.basicConfig()`, like\n    `INFO:my_module:Some message.` This is not currently customizable.\n\n    To capture all logs, pass the name of the root logger, which is \'root\'.\n\n    This is independent of the `console` setting: both can be active\n    simultaneously.\n\n    Example:\n    ```python\n    wandb.init(\n        settings=wandb.Settings(\n            console="off",\n            capture_loggers={\n                "my_app": "INFO",\n                "my_app.training": "ERROR",\n            },\n        ),\n    )\n    ```\n    '
    credentials_file: str = Field(default_factory=lambda: str(credentials.DEFAULT_WANDB_CREDENTIALS_FILE))
    'Path to file for writing temporary access tokens.'
    disable_code: bool = False
    'Whether to disable capturing the code.'
    disable_git: bool = False
    'Whether to disable capturing the git state.'
    disable_git_fork_point: bool = True
    'Whether to disable inferring fork point from remote branches\n\n    When set to True, the SDK will use the latest commit from the upstream\n    branch, if one is set. Otherwise skip generating the diff patch.\n\n    When set to False, the SDK will try to use the latest commit from the upstream branch,\n    if one is set.\n    Otherwise, it will find the closest commit from all remote branches.\n    This may impact performance for repos with many upstream branches.\n    '
    disable_job_creation: bool = True
    'Whether to disable the creation of a job artifact for W&B Launch.'
    docker: str | None = None
    'The Docker image used to execute the script.'
    email: str | None = None
    'The email address of the user.'
    entity: str | None = None
    'The W&B entity, such as a user or a team.'
    organization: str | None = None
    'The W&B organization.'
    force: bool = False
    'Whether to pass the `force` flag to `wandb.login()`.'
    fork_from: RunMoment | None = None
    "Specifies a point in a previous execution of a run to fork from.\n\n    The point is defined by the run ID, a metric, and its value.\n    Currently, only the metric '_step' is supported.\n    "
    git_commit: str | None = None
    'The git commit hash to associate with the run.'
    git_remote: str = 'origin'
    'The git remote to associate with the run.'
    git_remote_url: str | None = None
    'The URL of the git remote repository.'
    git_root: str | None = None
    'Root directory of the git repository.'
    heartbeat_seconds: int = 30
    'Interval in seconds between heartbeat signals sent to the W&B servers.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    host: str | None = None
    'Hostname of the machine running the script.'
    http_proxy: str | None = None
    'Custom proxy servers for http requests to W&B.'
    https_proxy: str | None = None
    'Custom proxy servers for https requests to W&B.'
    identity_token_file: str | None = None
    'Path to file containing an identity token (JWT) for authentication.'
    ignore_globs: Sequence[str] = ()
    'Unix glob patterns relative to `files_dir` specifying files to exclude from upload.'
    init_timeout: float = 90.0
    'Time in seconds to wait for the `wandb.init` call to complete before timing out.'
    finish_timeout: float = 0.0
    "Time in seconds to wait for data to upload at the end of a run.\n\n    Setting this can limit costs caused by slow uploads to W&B at the end of a\n    run, with the trade-off that the run will be marked crashed and may be\n    missing some data. The default is for `run.finish()` to block until all\n    data finishes uploading.\n\n    If this is set to a number greater than zero, W&B gives up on uploading a\n    run's data after this many seconds at the end of a run, unblocking your\n    script. After some time, the run becomes Crashed or Failed in the UI. Any\n    unuploaded data is still stored on disk and can be uploaded with `wandb\n    sync`.\n\n    Use the `finish_timeout_raises` setting to raise an error in addition to\n    printing a warning message.\n\n    Runs shut down by `wandb.teardown()` (which automatically runs at the end\n    of a script in an atexit hook) will also respect this setting.\n    "
    finish_timeout_raises: bool = False
    'Whether to raise a TimeoutError if finish_timeout expires.\n\n    Using this together with the `finish_timeout` setting causes `run.finish()`\n    to raise a TimeoutError after a timeout in addition to printing a message.\n\n    Note that `run.finish()` is called implicitly when using a Run as a context\n    manager:\n\n        with wandb.init() as run:\n            ...  # run.finish() executes at the end of the `with` block\n\n    This does not cause `wandb.teardown()` to raise an error (since it runs\n    at the end of a script anyway).\n    '
    insecure_disable_ssl: bool = False
    'Whether to insecurely disable SSL verification.'
    job_name: str | None = None
    'Name of the Launch job running the script.'
    job_source: Literal['repo', 'artifact', 'image'] | None = None
    'Source type for Launch.'
    label_disable: bool = False
    'Whether to disable automatic labeling features.'
    launch: bool = False
    'Flag to indicate if the run is being launched through W&B Launch.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    launch_config_path: str | None = None
    'Path to the launch configuration file.'
    login_timeout: float | None = None
    'Time in seconds to wait for login operations before timing out.'
    mode: Literal['online', 'offline', 'shared', 'disabled', 'dryrun', 'run'] = Field(default='online', validate_default=True)
    'The operating mode for W&B logging and synchronization.'
    notebook_name: str | None = None
    'Name of the notebook if running in a Jupyter-like environment.'
    program: str | None = None
    'Path to the script that created the run, if available.'
    program_abspath: str | None = None
    "The absolute path from the root repository directory to the script that\n    created the run.\n\n    Root repository directory is defined as the directory containing the\n    .git directory, if it exists. Otherwise, it's the current working directory.\n    "
    program_relpath: str | None = None
    'The relative path to the script that created the run.'
    project: str | None = None
    'The W&B project ID.'
    quiet: bool = False
    'Flag to suppress non-essential output.'
    reinit: Literal['default', 'return_previous', 'finish_previous', 'create_new'] | bool = 'default'
    'What to do when `wandb.init()` is called while a run is active.\n\n    Options:\n    - "default": Use "finish_previous" in notebooks and "return_previous"\n        otherwise.\n    - "return_previous": Return the most recently created run\n        that is not yet finished. This does not update `wandb.run`; see\n        the "create_new" option.\n    - "finish_previous": Finish all active runs, then return a new run.\n    - "create_new": Create a new run without modifying other active runs.\n        Does not update `wandb.run` and top-level functions like `wandb.log`.\n        Because of this, some older integrations that rely on the global run\n        will not work.\n\n    Can also be a boolean, but this is deprecated. False is the same as\n    "return_previous", and True is the same as "finish_previous".\n    '
    relogin: bool = False
    'Flag to force a new login attempt.'
    resume: Literal['allow', 'must', 'never', 'auto'] | None = None
    'Specifies the resume behavior for the run.\n\n    Options:\n    - "must": Resumes from an existing run with the same ID. If no such run exists,\n       it will result in failure.\n    - "allow": Attempts to resume from an existing run with the same ID. If none is\n       found, a new run will be created.\n    - "never": Always starts a new run. If a run with the same ID already exists,\n       it will result in failure.\n    - "auto": Automatically resumes from the most recent failed run on the same\n       machine.\n    '
    resume_from: RunMoment | None = None
    "Specifies a point in a previous execution of a run to resume from.\n\n    The point is defined by the run ID, a metric, and its value.\n    Currently, only the metric '_step' is supported.\n    "
    resumed: bool = False
    'Indication from the server about the state of the run.\n\n    This is different from resume, a user provided flag.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    root_dir: str = Field(default_factory=lambda: os.path.abspath(os.getcwd()))
    'The root directory to use as the base for all run-related paths.\n\n    In particular, this is used to derive the wandb directory and the run directory.\n    '
    run_group: str | None = None
    'Group identifier for related runs.\n\n    Used for grouping runs in the UI.\n    '
    run_id: str | None = None
    'The ID of the run.'
    run_job_type: str | None = None
    'Type of job being run (e.g., training, evaluation).'
    run_name: str | None = None
    'Human-readable name for the run.'
    run_notes: str | None = None
    'Additional notes or description for the run.'
    run_tags: tuple[str, ...] | None = None
    'Tags to associate with the run for organization and filtering.'
    sagemaker_disable: bool = False
    'Flag to disable SageMaker-specific functionality.'
    save_code: bool | None = None
    'Whether to save the code associated with the run.'
    settings_system: str | None = None
    'Path to the system-wide settings file.'
    stop_fn: Callable[[], None] | None = None
    'A callback to execute to stop the run.\n\n    A run can be stopped through the web UI, or after a fatal error\n    (if configured via a setting).\n\n    By default, to stop a run, W&B sends a SIGINT to the main thread.\n    Set this callback to override this behavior, like to use a different\n    signal or to take some other action before interrupting.\n\n    The callback runs in a separate thread. It runs soon after a stop is\n    requested, but not immediately.\n    '
    max_end_of_run_history_metrics: int = 10
    'Maximum number of history sparklines to display at the end of a run.'
    max_end_of_run_summary_metrics: int = 10
    'Maximum number of summary metrics to display at the end of a run.'
    show_colors: bool | None = None
    'Whether to use colored output in the console.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    show_emoji: bool | None = None
    'Whether to show emoji in the console output.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    show_errors: bool = True
    'Whether to display error messages.'
    show_info: bool = True
    'Whether to display informational messages.'
    show_warnings: bool = True
    'Whether to display warning messages.'
    silent: bool = False
    'Flag to suppress all output.'
    start_method: str | None = None
    'Method to use for starting subprocesses.\n\n    This is deprecated and will be removed in a future release.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    stop_on_fatal_error: bool = False
    "Whether to stop the run after a fatal error.\n\n    After W&B hits an unrecoverable error while uploading data, it prints\n    a message and stops uploading, but still allows logging more data.\n    This is usually desirable: your training metrics get stored on disk\n    and can be recovered using `wandb sync`, even if they aren't uploaded.\n\n    This is not useful if your files get deleted after training.\n    In that case, setting this to True will stop the run after a fatal error,\n    as if the stop button was pressed in the web UI.\n    "
    strict: bool | None = None
    'Whether to enable strict mode for validation and error checking.'
    summary_timeout: int = 60
    'Time in seconds to wait for summary operations before timing out.'
    summary_warnings: int = 5
    'Maximum number of summary warnings to display.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    sweep_id: str | None = None
    'Identifier of the sweep this run belongs to.'
    sweep_param_path: str | None = None
    'Path to the sweep parameters configuration.'
    symlink: bool = Field(default_factory=lambda: platform.system() != 'Windows')
    'Whether to use symlinks (True by default except on Windows).'
    sync_tensorboard: bool | None = None
    'Whether to synchronize TensorBoard logs with W&B.'
    table_raise_on_max_row_limit_exceeded: bool = False
    'Whether to raise an exception when table row limits are exceeded.'
    use_dot_wandb: bool | None = None
    'Whether to use a hidden `.wandb` or visible `wandb` directory for run data.\n\n    If True, the SDK uses `.wandb`. If False, `wandb`.\n    If not set, defaults to `.wandb` if it already exists, otherwise `wandb`.\n    '
    username: str | None = None
    'Username.'
    x_cli_only_mode: bool = False
    'Flag to indicate that the SDK is running in CLI-only mode.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_disable_meta: bool = False
    'Flag to disable the collection of system metadata.'
    x_disable_stats: bool = False
    'Flag to disable the collection of system metrics.'
    x_disable_viewer: bool = False
    'Flag to disable the early viewer query.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_disable_machine_info: bool = False
    'Flag to disable automatic machine info collection.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_executable: str | None = None
    'Path to the Python executable.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_extra_http_headers: dict[str, str] | None = None
    'Additional headers to add to all outgoing HTTP requests.'
    x_file_stream_max_bytes: int | None = None
    'An approximate maximum request size for the filestream API.\n\n    Its purpose is to prevent HTTP requests from failing due to\n    containing too much data. This number is approximate:\n    requests will be slightly larger.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_file_stream_max_line_bytes: int | None = None
    'Maximum line length for filestream JSONL files.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_file_stream_transmit_interval: float | None = None
    'Interval in seconds between filestream transmissions.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_file_stream_retry_max: int | None = None
    'Max number of retries for filestream operations.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_file_stream_retry_wait_min_seconds: float | None = None
    'Minimum wait time between retries for filestream operations.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_file_stream_retry_wait_max_seconds: float | None = None
    'Maximum wait time between retries for filestream operations.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_file_stream_timeout_seconds: float | None = None
    'Timeout in seconds for individual filestream HTTP requests.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_file_transfer_retry_max: int | None = None
    'Max number of retries for file transfer operations.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_file_transfer_retry_wait_min_seconds: float | None = None
    'Minimum wait time between retries for file transfer operations.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_file_transfer_retry_wait_max_seconds: float | None = None
    'Maximum wait time between retries for file transfer operations.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_file_transfer_timeout_seconds: float | None = None
    'Timeout in seconds for individual file transfer HTTP requests.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_files_dir: str | None = None
    'Override setting for the computed files_dir.\n\n    DEPRECATED, DO NOT USE. This private setting is not respected by wandb-core\n    but will continue to work for some legacy Python code.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_flow_control_custom: bool | None = None
    'Flag indicating custom flow control for filestream.\n\n    TODO: Not implemented in wandb-core.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_flow_control_disabled: bool | None = None
    'Flag indicating flow control is disabled for filestream.\n\n    TODO: Not implemented in wandb-core.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_graphql_retry_max: int | None = None
    'Max number of retries for GraphQL operations.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_graphql_retry_wait_min_seconds: float | None = None
    'Minimum wait time between retries for GraphQL operations.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_graphql_retry_wait_max_seconds: float | None = None
    'Maximum wait time between retries for GraphQL operations.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_graphql_timeout_seconds: float | None = None
    'Timeout in seconds for individual GraphQL requests.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_internal_check_process: float = 8.0
    'Interval for internal process health checks in seconds.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_jupyter_name: str | None = None
    'Name of the Jupyter notebook.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_jupyter_path: str | None = None
    'Path to the Jupyter notebook.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_jupyter_root: str | None = None
    'Root directory of the Jupyter notebook.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_label: str | None = None
    'Label to assign to system metrics and console logs collected for the run.\n\n    This is used to group data by on the frontend and can be used to distinguish data\n    from different processes in a distributed training job.\n    '
    x_live_policy_rate_limit: int | None = None
    'Rate limit for live policy updates in seconds.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_live_policy_wait_time: int | None = None
    'Wait time between live policy updates in seconds.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_log_level: int = logging.INFO
    'Logging level for internal operations.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_network_buffer: int | None = None
    'Size of the network buffer used in flow control.\n\n    TODO: Not implemented in wandb-core.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_primary: bool = Field(default=True, validation_alias=AliasChoices('x_primary', 'x_primary_node'))
    'Determines whether to save internal wandb files and metadata.\n\n    In a distributed setting, this is useful for avoiding file overwrites\n    from secondary processes when only system metrics and logs are needed,\n    as the primary process handles the main logging.\n    '
    x_proxies: dict[str, str] | None = None
    'Custom proxy servers for requests to W&B.\n\n    This is deprecated and will be removed in a future release.\n    Please use `http_proxy` and `https_proxy` instead.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_runqueue_item_id: str | None = None
    'ID of the Launch run queue item being processed.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_save_requirements: bool = True
    'Flag to save the requirements file.'
    x_server_side_derived_summary: bool = False
    'Flag to delegate automatic computation of summary from history to the server.\n\n    This does not disable user-provided summary updates.\n    '
    x_server_side_expand_glob_metrics: bool = True
    'Flag to delegate glob matching of metrics in define_metric to the server.\n\n    If the server does not support this, the client will perform the glob matching.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_service_transport: str | None = None
    'Transport method for communication with the wandb service.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_service_wait: float = 30.0
    'Time in seconds to wait for the wandb-core internal service to start.'
    x_skip_transaction_log: bool = False
    'Whether to skip saving the run events to the transaction log.\n\n    This is only relevant for online runs. Can be used to reduce the amount of\n    data written to disk.\n\n    Should be used with caution, as it removes the gurantees about\n    recoverability.\n    '
    x_start_time: float | None = None
    'The start time of the run in seconds since the Unix epoch.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_stats_pid: int = os.getpid()
    'PID of the process that started the wandb-core process to collect system stats for.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_stats_sampling_interval: float = Field(default=15.0)
    'Sampling interval for the system monitor in seconds.'
    x_stats_neuron_monitor_config_path: str | None = None
    'Path to the default config file for the neuron-monitor tool.\n\n    This is used to monitor AWS Trainium devices.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_stats_dcgm_exporter: str | None = None
    'Endpoint to extract Nvidia DCGM metrics from.\n\n    Options:\n     - Extract DCGM-related metrics from a query to the Prometheus `/api/v1/query` endpoint.\n        It is a common practice to aggregate metrics reported by the instances of the DCGM Exporter\n        running on different nodes in a cluster using Prometheus.\n     - TODO: Parse metrics directly from the `/metrics` endpoint of the DCGM Exporter.\n\n    Examples:\n     - `http://localhost:9400/api/v1/query?query=DCGM_FI_DEV_GPU_TEMP{node="l1337", cluster="globular"}`.\n     - TODO: `http://192.168.0.1:9400/metrics`.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_stats_open_metrics_endpoints: dict[str, str] | None = None
    'OpenMetrics `/metrics` endpoints to monitor for system metrics.'
    x_stats_open_metrics_filters: dict[str, dict[str, str]] | Sequence[str] | None = None
    'Filter to apply to metrics collected from OpenMetrics `/metrics` endpoints.\n\n    Supports two formats:\n     - `{"metric regex pattern, including endpoint name as prefix": {"label": "label value regex pattern"}}`\n     - `("metric regex pattern 1", "metric regex pattern 2", ...)`\n    '
    x_stats_open_metrics_http_headers: dict[str, str] | None = None
    'HTTP headers to add to OpenMetrics requests.'
    x_stats_disk_paths: Sequence[str] | None = ('/',)
    'System paths to monitor for disk usage.'
    x_stats_cpu_count: int | None = None
    'System CPU count.\n\n    If set, overrides the auto-detected value in the run metadata.\n    '
    x_stats_cpu_logical_count: int | None = None
    'Logical CPU count.\n\n    If set, overrides the auto-detected value in the run metadata.\n    '
    x_stats_gpu_count: int | None = None
    'GPU device count.\n\n    If set, overrides the auto-detected value in the run metadata.\n    '
    x_stats_gpu_type: str | None = None
    'GPU device type.\n\n    If set, overrides the auto-detected value in the run metadata.\n    '
    x_stats_gpu_device_ids: Sequence[int] | None = None
    'GPU device indices to monitor.\n\n    If not set, the system monitor captures metrics for all GPUs.\n    Assumes 0-based indexing matching CUDA/ROCm device enumeration.\n    '
    x_stats_buffer_size: int = 0
    'Number of system metric samples to buffer in memory in the wandb-core process.\n\n    Can be accessed via run._system_metrics.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_stats_coreweave_metadata_base_url: str = 'http://169.254.169.254'
    'The scheme and hostname for contacting the CoreWeave metadata server.\n\n    Only accessible from within a CoreWeave cluster.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_stats_coreweave_metadata_endpoint: str = '/api/v2/cloud-init/meta-data'
    'The relative path on the CoreWeave metadata server to which to make requests.\n\n    This must not include the schema and hostname prefix.\n    Only accessible from within a CoreWeave cluster.\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_stats_track_process_tree: bool = False
    'Monitor the entire process tree for resource usage, starting from `x_stats_pid`.\n\n    When `True`, the system monitor aggregates the RSS, CPU%, and thread count\n    from the process with PID `x_stats_pid` and all of its descendants.\n    This can have a performance overhead and is disabled by default.\n    '
    x_stats_no_cgroup: bool = False
    'Disable cgroup v2 CPU and memory limits for system metric percentages.'
    x_sync: bool = False
    'Flag to indicate whether we are syncing a run from the transaction log.\n\n    <!-- lazydoc-ignore-class-attributes -->\n    '
    x_sync_dir_suffix: str = ''
    "Suffix to add to the run's directory name (sync_dir).\n\n    This is set in wandb.init() to avoid naming conflicts.\n    If set, it is joined to the default name with a dash.\n    "
    x_update_finish_state: bool = True
    "Flag to indicate whether this process can update the run's final state on the server.\n\n    Set to False in distributed training when only the main process should determine the final state.\n    "

    @model_validator(mode='before')
    @classmethod
    def catch_private_settings(cls, values):
        """Check if a private field is provided and assign to the corresponding public one.

        This is a compatibility layer to handle previous versions of the settings.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        new_values = {}
        for key in values:
            if key.startswith('_'):
                new_values['x' + key] = values[key]
            else:
                new_values[key] = values[key]
        return new_values

    @model_validator(mode='after')
    def validate_mutual_exclusion_of_branching_args(self) -> Self:
        """Check if `fork_from`, `resume`, and `resume_from` are mutually exclusive.

        <!-- lazydoc-ignore: internal -->
        """
        if sum((o is not None for o in [self.fork_from, self.resume, self.resume_from])) > 1:
            raise ValueError('`fork_from`, `resume`, or `resume_from` are mutually exclusive. Please specify only one of them.')
        return self

    @model_validator(mode='after')
    def validate_skip_transaction_log(self):
        """Validate x_skip_transaction_log.

        <!-- lazydoc-ignore: internal -->
        """
        if self._offline and self.x_skip_transaction_log:
            raise ValueError('Cannot skip transaction log in offline mode')
        return self

    @field_validator('anonymous', mode='after')
    @classmethod
    def validate_anonymous(cls, value: object) -> object:
        if value is not deprecation.UNSET:
            lumina.termwarn('The anonymous setting has no effect and will be removed' + ' in a future version.', repeat=False)
        return value

    @field_validator('api_key', mode='after')
    @classmethod
    def validate_api_key(cls, value):
        """Validate the API key.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value is not None and len(value) > len(value.strip()):
            raise UsageError('API key cannot start or end with whitespace')
        return value

    @field_validator('base_url', mode='after')
    @classmethod
    def validate_base_url(cls, value):
        """Validate the base URL.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        urls.validate_url(value)
        if re.match('.*wandb\\.ai[^\\.]*$', value) and 'api.' not in value:
            raise ValueError(f'{value} is not a valid server address, did you mean https://api.wandb.ai?')
        elif re.match('.*wandb\\.ai[^\\.]*$', value) and (not value.startswith('https')):
            raise ValueError('http is not secure, please use https://api.wandb.ai')
        return value.rstrip('/')

    @field_validator('code_dir', mode='before')
    @classmethod
    def validate_code_dir(cls, value):
        """Validate the code directory.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, pathlib.Path):
            return str(value)
        return value

    @field_validator('console', mode='after')
    @classmethod
    def validate_console(cls, value, values):
        """Validate the console capture method.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value != 'auto':
            return value
        return 'wrap'

    @field_validator('console_chunk_max_bytes', mode='after')
    @classmethod
    def validate_console_chunk_max_bytes(cls, value):
        """Validate the console_chunk_max_bytes value.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value < 0:
            raise ValueError('console_chunk_max_bytes must be non-negative')
        return value

    @field_validator('console_chunk_max_seconds', mode='after')
    @classmethod
    def validate_console_chunk_max_seconds(cls, value):
        """Validate the console_chunk_max_seconds value.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value < 0:
            raise ValueError('console_chunk_max_seconds must be non-negative')
        return value

    @field_validator('x_executable', mode='before')
    @classmethod
    def validate_x_executable(cls, value):
        """Validate the Python executable path.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, pathlib.Path):
            return str(value)
        return value

    @field_validator('x_extra_http_headers', mode='before')
    @classmethod
    def validate_x_extra_http_headers(cls, value):
        if isinstance(value, str):
            return json.loads(value)
        return value

    @field_validator('x_file_stream_max_line_bytes', mode='after')
    @classmethod
    def validate_file_stream_max_line_bytes(cls, value):
        """Validate the maximum line length for filestream JSONL files.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value is not None and value < 1:
            raise ValueError('File stream max line bytes must be greater than 0')
        return value

    @field_validator('x_files_dir', mode='before')
    @classmethod
    def validate_x_files_dir(cls, value):
        """Validate the files directory.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, pathlib.Path):
            return str(value)
        return value

    @field_validator('fork_from', mode='before')
    @classmethod
    def validate_fork_from(cls, value, values) -> RunMoment | None:
        """Validate the fork_from field.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        run_moment = cls._runmoment_preprocessor(value)
        values = values.data
        if run_moment and values.get('run_id') is not None and (values.get('run_id') == run_moment.run):
            raise ValueError('Provided `run_id` is the same as the run to `fork_from`. Please provide a different `run_id` or remove the `run_id` argument. If you want to rewind the current run, please use `resume_from` instead.')
        return run_moment

    @field_validator('http_proxy', mode='after')
    @classmethod
    def validate_http_proxy(cls, value):
        """Validate the HTTP proxy.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value is None:
            return None
        urls.validate_url(value)
        return value.rstrip('/')

    @field_validator('https_proxy', mode='after')
    @classmethod
    def validate_https_proxy(cls, value):
        """Validate the HTTPS proxy.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value is None:
            return None
        urls.validate_url(value)
        return value.rstrip('/')

    @field_validator('ignore_globs', mode='after')
    @classmethod
    def validate_ignore_globs(cls, value):
        """Validate the ignore globs.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        return tuple(value) if not isinstance(value, tuple) else value

    @field_validator('program', mode='before')
    @classmethod
    def validate_program(cls, value):
        """Validate the program path.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, pathlib.Path):
            return str(value)
        return value

    @field_validator('program_abspath', mode='before')
    @classmethod
    def validate_program_abspath(cls, value):
        """Validate the absolute program path.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, pathlib.Path):
            return str(value)
        return value

    @field_validator('program_relpath', mode='before')
    @classmethod
    def validate_program_relpath(cls, value):
        """Validate the relative program path.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, pathlib.Path):
            return str(value)
        return value

    @field_validator('project', mode='after')
    @classmethod
    def validate_project(cls, value, values):
        """Validate the project name.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value is None:
            return None
        invalid_chars_list = list('/\\#?%:')
        if len(value) > 128:
            raise UsageError(f'Invalid project name {value!r}: exceeded 128 characters')
        invalid_chars = {char for char in invalid_chars_list if char in value}
        if invalid_chars:
            raise UsageError(f"Invalid project name {value!r}: cannot contain characters {','.join(invalid_chars_list)!r}, found {','.join(invalid_chars)!r}")
        return value

    @field_validator('resume', mode='before')
    @classmethod
    def validate_resume(cls, value):
        """Validate the resume behavior.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value is False:
            return None
        if value is True:
            return 'auto'
        return value

    @field_validator('resume_from', mode='before')
    @classmethod
    def validate_resume_from(cls, value, values) -> RunMoment | None:
        """Validate the resume_from field.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        run_moment = cls._runmoment_preprocessor(value)
        values = values.data
        if run_moment and values.get('run_id') is not None and (values.get('run_id') != run_moment.run):
            raise ValueError('Both `run_id` and `resume_from` have been specified with different ids.')
        return run_moment

    @field_validator('root_dir', mode='before')
    @classmethod
    def validate_root_dir(cls, value):
        """Validate the root directory.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, pathlib.Path):
            return str(value)
        return value

    @field_validator('run_id', mode='after')
    @classmethod
    def validate_run_id(cls, value, values):
        """Validate the run ID.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value is None:
            return None
        if len(value) == 0:
            raise UsageError('Run ID cannot be empty')
        if len(value) > len(value.strip()):
            raise UsageError('Run ID cannot start or end with whitespace')
        if not bool(value.strip()):
            raise UsageError('Run ID cannot contain only whitespace')
        reserved_chars = ":;,#?/'"
        if any((char in reserved_chars for char in value)):
            raise UsageError(f'Run ID cannot contain the characters: {reserved_chars}')
        return value

    @field_validator('settings_system', mode='after')
    @classmethod
    def validate_settings_system(cls, value):
        """Validate the system settings file path.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value is None:
            return None
        elif isinstance(value, pathlib.Path):
            return str(_path_convert(value))
        else:
            return _path_convert(value)

    @field_validator('x_service_wait', mode='after')
    @classmethod
    def validate_service_wait(cls, value):
        """Validate the service wait time.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value < 0:
            raise UsageError('Service wait time cannot be negative')
        return value

    @field_validator('start_method', mode='after')
    @classmethod
    def validate_start_method(cls, value):
        """Validate the start method for subprocesses.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value is None:
            return value
        lumina.termwarn('`start_method` is deprecated and will be removed in a future version of wandb. This setting is currently non-functional and safely ignored.', repeat=False)
        return value

    @field_validator('x_stats_coreweave_metadata_base_url', mode='after')
    @classmethod
    def validate_x_stats_coreweave_metadata_base_url(cls, value):
        urls.validate_url(value)
        return value.rstrip('/')

    @field_validator('x_stats_gpu_device_ids', mode='before')
    @classmethod
    def validate_x_stats_gpu_device_ids(cls, value):
        """Validate the GPU device IDs.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, str):
            return json.loads(value)
        return value

    @field_validator('x_stats_neuron_monitor_config_path', mode='before')
    @classmethod
    def validate_x_stats_neuron_monitor_config_path(cls, value):
        """Validate the path to the neuron-monitor config file.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, pathlib.Path):
            return str(value)
        return value

    @field_validator('x_stats_open_metrics_endpoints', mode='before')
    @classmethod
    def validate_stats_open_metrics_endpoints(cls, value):
        """Validate the OpenMetrics endpoints.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, str):
            return json.loads(value)
        return value

    @field_validator('x_stats_open_metrics_filters', mode='before')
    @classmethod
    def validate_stats_open_metrics_filters(cls, value):
        """Validate the OpenMetrics filters.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, str):
            return json.loads(value)
        return value

    @field_validator('x_stats_open_metrics_http_headers', mode='before')
    @classmethod
    def validate_stats_open_metrics_http_headers(cls, value):
        """Validate the OpenMetrics HTTP headers.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, str):
            return json.loads(value)
        return value

    @field_validator('x_stats_sampling_interval', mode='after')
    @classmethod
    def validate_stats_sampling_interval(cls, value):
        """Validate the stats sampling interval.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value < 0.1:
            raise UsageError('Stats sampling interval cannot be less than 0.1 seconds')
        return value

    @field_validator('sweep_id', mode='after')
    @classmethod
    def validate_sweep_id(cls, value):
        """Validate the sweep ID.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if value is None:
            return None
        if len(value) == 0:
            raise UsageError('Sweep ID cannot be empty')
        if len(value) > len(value.strip()):
            raise UsageError('Sweep ID cannot start or end with whitespace')
        if not bool(value.strip()):
            raise UsageError('Sweep ID cannot contain only whitespace')
        return value

    @field_validator('run_tags', mode='before')
    @classmethod
    def validate_run_tags(cls, value):
        """Validate run tags.

        Validates that each tag:
        - Is between 1 and 64 characters in length (inclusive)
        - Converts single string values to tuple format
        - Preserves None values

        <!-- lazydoc-ignore-classmethod: internal -->

        Args:
            value: A string, list, tuple, or None representing tags

        Returns:
            tuple: A tuple of validated tags, or None

        Raises:
            ValueError: If any tag is empty or exceeds 64 characters
        """
        if value is None:
            return None
        if isinstance(value, str):
            tags = (value,)
        else:
            tags = tuple(value)
        errors = []
        for i, tag in enumerate(tags):
            tag_str = str(tag)
            if len(tag_str) == 0:
                errors.append(f'Tag at index {i} is empty. Tags must be between 1 and 64 characters')
            elif len(tag_str) > 64:
                display_tag = f'{tag_str[:20]}...{tag_str[-20:]}' if len(tag_str) > 43 else tag_str
                errors.append(f"Tag '{display_tag}' is {len(tag_str)} characters. Tags must be between 1 and 64 characters")
        if errors:
            raise ValueError('; '.join(errors))
        return tags

    @field_validator('sweep_param_path', mode='before')
    @classmethod
    def validate_sweep_param_path(cls, value):
        """Validate the sweep parameter path.

        <!-- lazydoc-ignore-classmethod: internal -->
        """
        if isinstance(value, pathlib.Path):
            return str(value)
        return value

    @computed_field
    @property
    def _args(self) -> list[str]:
        if not self._jupyter:
            return sys.argv[1:]
        return []

    @computed_field
    @property
    def _aws_lambda(self) -> bool:
        """Check if we are running in a lambda environment."""
        from sentry_sdk.integrations.aws_lambda import get_lambda_bootstrap
        lambda_bootstrap = get_lambda_bootstrap()
        return not (not lambda_bootstrap or not hasattr(lambda_bootstrap, 'handle_event_request'))

    @computed_field
    @property
    def _code_path_local(self) -> str | None:
        """The relative path from the current working directory to the code path.

        For example, if the code path is /home/user/project/example.py, and the
        current working directory is /home/user/project, then the code path local
        is example.py.

        If couldn't find the relative path, this will be an empty string.
        """
        return self._get_program_relpath(self.program) if self.program else None

    @computed_field
    @property
    def _colab(self) -> bool:
        return 'google.colab' in sys.modules

    @computed_field
    @property
    def _ipython(self) -> bool:
        return ipython.in_ipython()

    @computed_field
    @property
    def _jupyter(self) -> bool:
        return ipython.in_jupyter()

    @computed_field
    @property
    def _kaggle(self) -> bool:
        return util._is_likely_kaggle()

    @computed_field
    @property
    def _noop(self) -> bool:
        return self.mode == 'disabled'

    @computed_field
    @property
    def _notebook(self) -> bool:
        return self._ipython or self._jupyter or self._colab or self._kaggle

    @computed_field
    @property
    def _offline(self) -> bool:
        return self.mode in ('offline', 'dryrun')

    @computed_field
    @property
    def _os(self) -> str:
        """The operating system of the machine running the script."""
        return platform.platform(aliased=True)

    @computed_field
    @property
    def _platform(self) -> str:
        return f'{platform.system()}-{platform.machine()}'.lower()

    @computed_field
    @property
    def _python(self) -> str:
        return f'{platform.python_implementation()} {platform.python_version()}'

    @computed_field
    @property
    def _shared(self) -> bool:
        """Whether we are in shared mode.

        In "shared" mode, multiple processes can write to the same run,
        for example from different machines.
        """
        return self.mode == 'shared'

    @computed_field
    @property
    def _start_datetime(self) -> str:
        if self.x_start_time is None:
            return ''
        datetime_now = datetime.fromtimestamp(self.x_start_time)
        return datetime_now.strftime('%Y%m%d_%H%M%S')

    @computed_field
    @property
    def _tmp_code_dir(self) -> str:
        return _path_convert(self.sync_dir, 'tmp', 'code')

    @computed_field
    @property
    def _windows(self) -> bool:
        return platform.system() == 'Windows'

    @computed_field
    @property
    def app_url(self) -> str:
        """The URL for the W&B UI, usually https://wandb.ai.

        This is different from `base_url` (like https://api.wandb.ai) which
        is used to access W&B APIs programmatically.
        """
        return self.app_url_override or util.api_to_app_url(self.base_url)

    @computed_field
    @property
    def colab_url(self) -> str | None:
        """The URL to the Colab notebook, if running in Colab."""
        if not self._colab:
            return None
        if self.x_jupyter_path and self.x_jupyter_path.startswith('fileId='):
            unescaped = unquote(self.x_jupyter_path)
            return 'https://colab.research.google.com/notebook#' + unescaped
        return None

    @computed_field
    @property
    def deployment(self) -> Literal['local', 'cloud']:
        return 'local' if self.is_local else 'cloud'

    @computed_field
    @property
    def files_dir(self) -> str:
        """Absolute path to the local directory where the run's files are stored."""
        return self.x_files_dir or _path_convert(self.sync_dir, 'files')

    @computed_field
    @property
    def is_local(self) -> bool:
        return str(self.base_url) != 'https://api.wandb.ai'

    @computed_field
    @property
    def log_dir(self) -> str:
        """The directory for storing log files."""
        return _path_convert(self.sync_dir, 'logs')

    @computed_field
    @property
    def log_internal(self) -> str:
        """The path to the file to use for internal logs."""
        return _path_convert(self.log_dir, 'debug-internal.log')

    @computed_field
    @property
    def log_symlink_internal(self) -> str:
        """The path to the symlink to the internal log file of the most recent run."""
        return _path_convert(self.wandb_dir, 'debug-internal.log')

    @computed_field
    @property
    def log_symlink_user(self) -> str:
        """The path to the symlink to the user-process log file of the most recent run."""
        return _path_convert(self.wandb_dir, 'debug.log')

    @computed_field
    @property
    def log_user(self) -> str:
        """The path to the file to use for user-process logs."""
        return _path_convert(self.log_dir, 'debug.log')

    @computed_field
    @property
    def project_url(self) -> str:
        """The W&B URL where the project can be viewed."""
        project_url = self._project_url_base()
        if not project_url:
            return ''
        return project_url

    @computed_field
    @property
    def resume_fname(self) -> str:
        """The path to the resume file."""
        return _path_convert(self.wandb_dir, 'wandb-resume.json')

    @computed_field
    @property
    def run_mode(self) -> Literal['run', 'offline-run']:
        """The mode of the run. Can be either "run" or "offline-run"."""
        return 'run' if not self._offline else 'offline-run'

    @computed_field
    @property
    def run_url(self) -> str:
        """The W&B URL where the run can be viewed."""
        project_url = self._project_url_base()
        if not all([project_url, self.run_id]):
            return ''
        safe_chars = '=+&$@'
        return f"{project_url}/runs/{quote(self.run_id or '', safe=safe_chars)}"

    @computed_field
    @property
    def settings_workspace(self) -> str:
        """The path to the workspace settings file."""
        return _path_convert(self.wandb_dir, 'settings')

    @computed_field
    @property
    def sweep_url(self) -> str:
        """The W&B URL where the sweep can be viewed."""
        project_url = self._project_url_base()
        if not all([project_url, self.sweep_id]):
            return ''
        return f"{project_url}/sweeps/{quote(self.sweep_id or '')}"

    @computed_field
    @property
    def sync_dir(self) -> str:
        """The directory for storing the run's files."""
        name = f'{self.run_mode}-{self.timespec}-{self.run_id}'
        if self.x_sync_dir_suffix:
            name += f'-{self.x_sync_dir_suffix}'
        return _path_convert(self.wandb_dir, name)

    @computed_field
    @property
    def sync_file(self) -> str:
        """Path to the append-only binary transaction log file."""
        return _path_convert(self.sync_dir, f'run-{self.run_id}.wandb')

    @computed_field
    @property
    def sync_symlink_latest(self) -> str:
        """Path to the symlink to the most recent run's transaction log file."""
        return _path_convert(self.wandb_dir, 'latest-run')

    @computed_field
    @property
    def timespec(self) -> str:
        """The time specification for the run."""
        return self._start_datetime

    @computed_field
    @property
    def wandb_dir(self) -> str:
        """Full path to the wandb directory."""
        if self.use_dot_wandb is None:
            use_dot = pathlib.Path(self.root_dir, '.wandb').exists()
        else:
            use_dot = self.use_dot_wandb
        dirname = '.wandb' if use_dot else 'wandb'
        return str(pathlib.Path(self.root_dir, dirname).expanduser())

    def read_system_settings(self) -> settings_file.SettingsFiles:
        """Read settings from the workspace and global settings files.

        The files are determined by the settings_system and settings_workspace
        settings.

        The resulting object is a snapshot of the system settings at the time
        this function is used and does not reflect the settings on this Settings
        object. It can be used to update the files, and it should be short-lived
        since it does not reflect external changes to the files.

        Updating the settings files does not update this Settings instance
        and vice versa.

        <!-- lazydoc-ignore: internal -->
        """
        local_settings = pathlib.Path(self.settings_workspace)
        if self.settings_system:
            global_settings = pathlib.Path(self.settings_system)
        else:
            global_settings = None
        return settings_file.SettingsFiles(global_settings=global_settings, local_settings=local_settings)

    def update_from_system_settings(self) -> None:
        """Load settings from the settings files.

        If settings files contain invalid settings, prints and suppresses
        the error.

        <!-- lazydoc-ignore: internal -->
        """
        system_settings = self.read_system_settings()
        if len(system_settings.sources) == 0:
            return
        elif len(system_settings.sources) == 1:
            source_string = str(system_settings.sources[0])
        else:
            source_string = '\n' + '\n'.join((f'  {source}' for source in system_settings.sources))
        if not self.quiet and (not self.silent) and (not env.is_silent()):
            printed_sources = True
            lumina.termlog(f'Loading settings from {source_string}')
        else:
            printed_sources = False
        try:
            parsed_settings = _parse_system_settings(system_settings)
        except Exception as e:
            if not printed_sources:
                lumina.termerror(f'Failed to load settings from {source_string}')
            if isinstance(e, ValidationError):
                lumina.termerror(str(e))
            else:
                tb = traceback.format_exception(type(e), e, e.__traceback__)
                lumina.termerror(''.join(tb))
            return
        self.update_from_settings(parsed_settings)

    def update_from_env_vars(self, environ: dict[str, Any]):
        """Update settings from environment variables.

        <!-- lazydoc-ignore: internal -->
        """
        env_prefix: str = 'WANDB_'
        private_env_prefix: str = env_prefix + '_'
        special_env_var_names = {env.APP_URL: 'app_url_override', 'WANDB_SERVICE_TRANSPORT': 'x_service_transport', env.DIR: 'root_dir', env.NAME: 'run_name', env.NOTES: 'run_notes', env.TAGS: 'run_tags', env.JOB_TYPE: 'run_job_type', env.HTTP_TIMEOUT: 'x_graphql_timeout_seconds', env.FILE_PUSHER_TIMEOUT: 'x_file_transfer_timeout_seconds', env.USER_EMAIL: 'email'}
        for setting, value in environ.items():
            if not setting.startswith(env_prefix):
                continue
            if setting in special_env_var_names:
                key = special_env_var_names[setting]
            elif setting.startswith(private_env_prefix):
                key = 'x_' + setting[len(private_env_prefix):].lower()
            else:
                key = setting[len(env_prefix):].lower()
            if key not in self.__dict__:
                continue
            if key in ('ignore_globs', 'run_tags'):
                value = value.split(',')
            if value is None:
                continue
            setattr(self, key, value)

    def update_from_system_environment(self):
        """Update settings from the system environment.

        <!-- lazydoc-ignore: internal -->
        """
        if (self.save_code is True or self.save_code is None) and (os.getenv(env.SAVE_CODE) is not None or os.getenv(env.DISABLE_CODE) is not None):
            self.save_code = env.should_save_code()
        if os.getenv(env.DISABLE_GIT) is not None:
            self.disable_git = env.disable_git()
        if self._jupyter and (self.notebook_name is None or self.notebook_name == ''):
            meta = lumina.jupyter.notebook_metadata(self.silent)
            self.x_jupyter_path = meta.get('path')
            self.x_jupyter_name = meta.get('name')
            self.x_jupyter_root = meta.get('root')
        elif self._jupyter and self.notebook_name is not None and os.path.exists(self.notebook_name):
            self.x_jupyter_path = self.notebook_name
            self.x_jupyter_name = self.notebook_name
            self.x_jupyter_root = os.getcwd()
        elif self._jupyter:
            lumina.termwarn(f"WANDB_NOTEBOOK_NAME should be a path to a notebook file, couldn't find {self.notebook_name}.")
        if self.host is None:
            self.host = socket.gethostname()
        _executable = self.x_executable or os.environ.get(env._EXECUTABLE) or sys.executable or shutil.which('python3') or 'python3'
        self.x_executable = _executable
        if self.docker is None:
            self.docker = env.get_docker(util.image_id_from_k8s())
        if self.x_cli_only_mode:
            return
        program = self.program or self._get_program()
        if program is not None:
            self._setup_code_paths(program)
        else:
            program = '<python with no main file>'
        self.program = program

    def infer_git_root(self) -> None:
        """Infer the git root from the root_dir setting using GitRepo.

        <!-- lazydoc-ignore: internal -->
        """
        if self.git_root is not None or self.disable_git:
            return
        from .lib.gitlib import GitRepo
        try:
            git_root = GitRepo(root=self.root_dir).root_dir
        except Exception:
            return
        if git_root is not None:
            self.git_root = str(git_root)

    def update_from_dict(self, settings: dict[str, Any]) -> None:
        """Update settings from a dictionary.

        <!-- lazydoc-ignore: internal -->
        """
        for key, value in dict(settings).items():
            if value is not None:
                setattr(self, key, value)

    def update_from_settings(self, settings: Settings) -> None:
        """Update settings from another instance of `Settings`.

        <!-- lazydoc-ignore: internal -->
        """
        d = {field: getattr(settings, field) for field in settings.model_fields_set}
        if d:
            self.update_from_dict(d)

    def to_proto(self) -> wandb_settings_pb2.Settings:
        """Generate a protobuf representation of the settings.

        <!-- lazydoc-ignore: internal -->
        """
        settings_proto = wandb_settings_pb2.Settings()
        for k, v in self.model_dump(exclude_none=True).items():
            if k in CLIENT_ONLY_SETTINGS:
                continue
            if k == 'x_stats_open_metrics_filters':
                if isinstance(v, (list, set, tuple)):
                    setting = getattr(settings_proto, k)
                    setting.sequence.value.extend(v)
                elif isinstance(v, dict):
                    setting = getattr(settings_proto, k)
                    for key, value in v.items():
                        for kk, vv in value.items():
                            setting.mapping.value[key].value[kk] = vv
                else:
                    raise TypeError(f'Unsupported type {type(v)} for setting {k}')
                continue
            if k in ('fork_from', 'resume_from'):
                run_moment = v if isinstance(v, RunMoment) else RunMoment(run=v.get('run'), value=v.get('value'), metric=v.get('metric'))
                getattr(settings_proto, k).CopyFrom(wandb_settings_pb2.RunMoment(run=run_moment.run, value=run_moment.value, metric=run_moment.metric))
                continue
            if isinstance(v, bool):
                getattr(settings_proto, k).CopyFrom(BoolValue(value=v))
            elif isinstance(v, int):
                getattr(settings_proto, k).CopyFrom(Int32Value(value=v))
            elif isinstance(v, float):
                getattr(settings_proto, k).CopyFrom(DoubleValue(value=v))
            elif isinstance(v, str):
                getattr(settings_proto, k).CopyFrom(StringValue(value=v))
            elif isinstance(v, (list, set, tuple)):
                sequence = getattr(settings_proto, k)
                sequence.value.extend(v)
            elif isinstance(v, dict):
                mapping = getattr(settings_proto, k)
                for key, value in v.items():
                    mapping.value[key] = value
            elif v is None:
                pass
            else:
                raise TypeError(f'Unsupported type {type(v)} for setting {k}')
        return settings_proto

    def _get_program(self) -> str | None:
        """Get the program that started the current process."""
        if self._jupyter:
            if self.notebook_name:
                return self.notebook_name
            if not self.x_jupyter_path:
                return self.program
            if self.x_jupyter_path.startswith('fileId='):
                return self.x_jupyter_name
            return self.x_jupyter_path
        program = os.getenv(env.PROGRAM)
        if program is not None:
            return program
        try:
            import __main__
        except ImportError:
            return None
        try:
            if __main__.__spec__ is None:
                python_args = __main__.__file__
            else:
                python_args = f'-m {__main__.__spec__.name}'
        except AttributeError:
            return None
        return python_args

    @staticmethod
    def _get_program_relpath(program: str, root: str | None=None) -> str | None:
        """Get the relative path to the program from the root directory."""
        if not program:
            return None
        root = root or os.getcwd()
        if not root:
            return None
        if not filesystem.are_paths_on_same_drive(pathlib.Path(root), pathlib.Path(program)):
            return None
        full_path_to_program = os.path.join(root, os.path.relpath(os.getcwd(), root), program)
        if os.path.exists(full_path_to_program):
            relative_path = os.path.relpath(full_path_to_program, start=root)
            if '../' in relative_path:
                return None
            return relative_path
        return None

    def _project_url_base(self) -> str:
        """Construct the base URL for the project."""
        if not all([self.entity, self.project]):
            return ''
        return f"{self.app_url}/{quote(self.entity or '')}/{quote(self.project or '')}"

    @staticmethod
    def _runmoment_preprocessor(val: RunMoment | str | None) -> RunMoment | None:
        """Preprocess the setting for forking or resuming a run."""
        if isinstance(val, RunMoment) or val is None:
            return val
        elif isinstance(val, str):
            return RunMoment.from_uri(val)

    def _setup_code_paths(self, program: str):
        """Sets the program_abspath and program_relpath settings."""
        if self._jupyter and self.x_jupyter_root:
            self._infer_code_paths_for_jupyter(program)
        else:
            self._infer_code_path_for_program(program)

    def _infer_code_path_for_program(self, program: str):
        """Finds the program's absolute and relative paths."""
        from .lib.gitlib import GitRepo
        try:
            root = GitRepo().root_dir or os.getcwd() if not self.disable_git else os.getcwd()
        except Exception:
            root = os.getcwd()
        self.program_relpath = self.program_relpath or self._get_program_relpath(program, root)
        program_abspath = os.path.abspath(os.path.join(root, os.path.relpath(os.getcwd(), root), program))
        if os.path.exists(program_abspath):
            self.program_abspath = program_abspath

    def _infer_code_paths_for_jupyter(self, program: str):
        """Find the notebook's absolute and relative paths.

        Since the notebook's execution environment
        is not the same as the current working directory.
        We utilize the metadata provided by the jupyter server.
        """
        if not self.x_jupyter_root or not program:
            return None
        self.program_abspath = os.path.abspath(os.path.join(self.x_jupyter_root, program))
        self.program_relpath = program

def _parse_system_settings(system_settings: settings_file.SettingsFiles) -> Settings:
    """Validate settings from a settings file.

    Returns:
        A validated Settings object.

    Raises:
        ValidationError: on invalid data.
        Exception: arbitrary errors can occur when constructing Settings.
    """
    fields: dict[str, Any] = dict()
    value: object
    for key, value in system_settings.all().items():
        if key == 'ignore_globs':
            fields[key] = value.split(',')
        elif key == 'anonymous':
            lumina.termwarn("Deprecated setting 'anonymous' has no effect and will be" + ' removed in a future version of wandb.' + ' Please delete it manually or by running `wandb login`' + ' to avoid errors.', repeat=False)
            fields[key] = deprecation.UNSET
        elif key in ('settings_system', 'root_dir'):
            lumina.termwarn(f'Ignoring setting {key!r} which is not allowed in a settings file.' + ' Please delete it manually to avoid errors in the future.')
        else:
            fields[key] = value
    return Settings(**fields)
