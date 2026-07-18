from __future__ import annotations
import base64
import datetime
import functools
import http.client
import json
import logging
import os
import re
import socket
import sys
import tempfile
from collections.abc import Callable, Iterable, Mapping, MutableMapping, Sequence
from copy import deepcopy
from pathlib import Path
from typing import IO, TYPE_CHECKING, Any, Literal, NamedTuple, TextIO, overload
import click
import lumina
from lumina import env, util
from lumina.analytics import get_sentry
from lumina.apis.normalize import normalize_exceptions
from lumina.errors import AuthenticationError, CommError, UsageError
from lumina.integration.sagemaker import parse_sm_secrets
from lumina.proto.wandb_api_pb2 import ApiRequest, DownloadFileRequest, UploadFileRequest
from lumina.proto.wandb_internal_pb2 import ServerFeature
from lumina.sdk import wandb_setup
from lumina.sdk.internal import settings_static
from lumina.sdk.internal._generated import SERVER_FEATURES_QUERY_GQL, ServerFeaturesQuery
from lumina.sdk.lib.hashutil import B64MD5, md5_file_b64
from lumina.sdk.lib.service.service_connection import WandbApiFailedError
from ..lib import retry, wbauth
from ..lib.filenames import DIFF_FNAME, METADATA_FNAME
from .progress import Progress
logger = logging.getLogger(__name__)
LAUNCH_DEFAULT_PROJECT = 'model-registry'
if TYPE_CHECKING:
    from typing import Literal, TypedDict
    import requests
    from lumina.apis.public.service_api import ServiceApi
    from .progress import ProgressFn

    class CreateArtifactFileSpecInput(TypedDict, total=False):
        """Corresponds to `type CreateArtifactFileSpecInput` in schema.graphql."""
        artifactID: str
        name: str
        md5: str
        mimetype: str | None
        artifactManifestID: str | None
        uploadPartsInput: list[dict[str, object]] | None

    class CreateArtifactFilesResponseFile(TypedDict):
        id: str
        name: str
        displayName: str
        uploadUrl: str | None
        uploadHeaders: Sequence[str]
        uploadMultipartUrls: UploadPartsResponse
        storagePath: str
        artifact: CreateArtifactFilesResponseFileNode

    class CreateArtifactFilesResponseFileNode(TypedDict):
        id: str

    class UploadPartsResponse(TypedDict):
        uploadUrlParts: list[UploadUrlParts]
        uploadID: str

    class UploadUrlParts(TypedDict):
        partNumber: int
        uploadUrl: str

    class CompleteMultipartUploadArtifactInput(TypedDict):
        """Corresponds to `type CompleteMultipartUploadArtifactInput` in schema.graphql."""
        completeMultipartAction: str
        completedParts: dict[int, str]
        artifactID: str
        storagePath: str
        uploadID: str
        md5: str

    class CompleteMultipartUploadArtifactResponse(TypedDict):
        digest: str

    class DefaultSettings(TypedDict, total=False):
        section: str
        git_remote: str
        ignore_globs: list[str]
        base_url: str
        root_dir: str | None
        api_key: str | None
        entity: str | None
        organization: str | None
        project: str | None
        _extra_http_headers: Mapping[str, str] | None
        _proxies: Mapping[str, str] | None
    _Response = MutableMapping
    SweepState = Literal['RUNNING', 'PAUSED', 'CANCELED', 'FINISHED']
    Number = int | float
httpclient_logger = logging.getLogger('http.client')
if os.environ.get('WANDB_DEBUG'):
    httpclient_logger.setLevel(logging.DEBUG)

def check_httpclient_logger_handler() -> None:
    if not os.environ.get('WANDB_DEBUG'):
        return
    if httpclient_logger.handlers:
        return
    level = logging.DEBUG

    def httpclient_log(*args: Any) -> None:
        httpclient_logger.log(level, ' '.join(args))
    http.client.print = httpclient_log
    http.client.HTTPConnection.debuglevel = 1
    root_logger = logging.getLogger('wandb')
    if root_logger.handlers:
        httpclient_logger.addHandler(root_logger.handlers[0])

class _OrgNames(NamedTuple):
    entity_name: str
    display_name: str

def _match_org_with_fetched_org_entities(organization: str, orgs: Sequence[_OrgNames]) -> str:
    """Match the organization provided in the path with the org entity or org name of the input entity.

    Args:
        organization: The organization name to match
        orgs: list of tuples containing (org_entity_name, org_display_name)

    Returns:
        str: The matched org entity name

    Raises:
        ValueError: If no matching organization is found or if multiple orgs exist without a match
    """
    for org_names in orgs:
        if organization in org_names:
            return org_names.entity_name
    if len(orgs) == 1:
        raise ValueError(f'Expecting the organization name or entity name to match {orgs[0].display_name!r} and cannot be linked/fetched with {organization!r}. Please update the target path with the correct organization name.')
    raise ValueError(f'Personal entity belongs to multiple organizations and cannot be linked/fetched with {organization!r}. Please update the target path with the correct organization name or use a team entity in the entity settings.')

class Api:
    """W&B Internal Api wrapper.

    Note:
        Settings are automatically overridden by looking for
        a `wandb/settings` file in the current working directory or its parent
        directory. If none can be found, we look in the current user's home
        directory.

    Args:
        default_settings(dict, optional): If you aren't using a settings
        file, or you wish to override the section to use in the settings file
        Override the settings here.
    """
    HTTP_TIMEOUT = env.get_http_timeout(20)
    FILE_PUSHER_TIMEOUT = env.get_file_pusher_timeout()

    def __init__(self, default_settings: wandb.Settings | settings_static.SettingsStatic | DefaultSettings | None=None, load_settings: bool=True, retry_timedelta: datetime.timedelta | None=None, environ: MutableMapping[str, str]=os.environ, retry_callback: Callable[[int, str], Any] | None=None, api_key: str | None=None) -> None:
        import requests
        self._environ = environ
        default_overrides: dict[str, Any] = dict(default_settings) if default_settings else {}
        self.default_settings: DefaultSettings = {'section': default_overrides.get('section', 'default'), 'git_remote': default_overrides.get('git_remote', 'origin'), 'ignore_globs': default_overrides.get('ignore_globs', []), 'base_url': default_overrides.get('base_url', 'https://api.wandb.ai'), 'root_dir': default_overrides.get('root_dir'), 'api_key': default_overrides.get('api_key'), 'entity': default_overrides.get('entity'), 'organization': default_overrides.get('organization'), 'project': default_overrides.get('project'), '_extra_http_headers': default_overrides.get('_extra_http_headers'), '_proxies': default_overrides.get('_proxies')}
        if load_settings:
            global_settings = wandb_setup.singleton().settings
            if (root_dir := self.default_settings['root_dir']):
                global_settings = global_settings.model_copy()
                global_settings.root_dir = root_dir
            self._settings = global_settings.read_system_settings().all()
        else:
            self._settings = {}
        self.dynamic_settings = {'system_sample_seconds': 2, 'system_samples': 15, 'heartbeat_seconds': 30}
        self.retry_timedelta = retry_timedelta or datetime.timedelta(days=7)
        self.retry_uploads = 10
        self._extra_http_headers = self.settings('_extra_http_headers') or json.loads(self._environ.get('WANDB__EXTRA_HTTP_HEADERS', '{}'))
        auth: tuple[str, str] | None = None
        api_key = api_key or self.default_settings.get('api_key')
        if api_key:
            auth = ('api', api_key)
        elif (access_token := self.access_token) is not None:
            self._extra_http_headers['Authorization'] = f'Bearer {access_token}'
        else:
            auth = ('api', self.api_key or '')
        proxies = self.settings('_proxies') or json.loads(self._environ.get('WANDB__PROXIES', '{}'))
        self._request_auth = auth
        request_headers = {'User-Agent': self.user_agent, 'X-WANDB-USERNAME': env.get_username(env=self._environ), 'X-WANDB-USER-EMAIL': env.get_user_email(env=self._environ), **self._extra_http_headers}
        self._request_headers = {key: value for key, value in request_headers.items() if value is not None}
        self._request_proxies = dict(proxies or {})
        self._service_api = self._new_service_api()
        self.retry_callback = retry_callback
        self._current_run_id: str | None = None
        self._file_stream_api = None
        self._upload_file_session = requests.Session()
        if self.FILE_PUSHER_TIMEOUT:
            self._upload_file_session.put = functools.partial(self._upload_file_session.put, timeout=self.FILE_PUSHER_TIMEOUT)
        if proxies:
            self._upload_file_session.proxies.update(proxies)
        self.upload_file_retry = normalize_exceptions(retry.retriable(retry_timedelta=retry_timedelta)(self.upload_file))
        self.upload_multipart_file_chunk_retry = normalize_exceptions(retry.retriable(retry_timedelta=retry_timedelta)(self.upload_multipart_file_chunk))
        self._client_id_mapping: dict[str, str] = {}
        self._azure_blob_module = util.get_module('azure.storage.blob')
        self._max_cli_version: str | None = None
        self._server_features_cache: dict[str, bool] | None = None

    def reauth(self) -> None:
        """Ensure the current api key is set on the service API."""
        self._request_auth = ('api', self.api_key or '')
        self._service_api = self._new_service_api()

    def relocate(self) -> None:
        """Ensure the current api points to the right server."""
        self._service_api = self._new_service_api()

    def execute(self, *args: Any, **kwargs: Any) -> _Response:
        return self._service_api.execute_graphql(*args, **kwargs)

    @normalize_exceptions
    def download_file(self, url: str, path: str) -> None:
        """Download the file at `url` to `path` via wandb-core's file transfer subsystem."""
        self._service_api.send_api_request(ApiRequest(download_file_request=DownloadFileRequest(url=url, path=path)))

    @property
    def request_auth(self) -> tuple[str, str] | None:
        return self._request_auth

    @property
    def request_headers(self) -> Mapping[str, str]:
        return self._request_headers

    @property
    def request_proxies(self) -> Mapping[str, str]:
        return self._request_proxies

    def _new_service_api(self) -> ServiceApi:
        from lumina.apis.public.service_api import ServiceApi
        settings = wandb_setup.singleton().settings.model_copy()
        settings.base_url = self.settings('base_url')
        settings.api_key = self._request_auth[1] if self._request_auth else ''
        settings.x_extra_http_headers = dict(self._request_headers)
        settings.x_graphql_timeout_seconds = self.HTTP_TIMEOUT
        if (http_proxy := self._request_proxies.get('http')):
            settings.http_proxy = http_proxy
        if (https_proxy := self._request_proxies.get('https')):
            settings.https_proxy = https_proxy
        return ServiceApi(settings=settings, timeout=self.HTTP_TIMEOUT)

    def validate_api_key(self) -> bool:
        """Returns whether the API key stored on initialization is valid."""
        res = self.execute('query { viewer { id } }')
        return res is not None and res['viewer'] is not None

    def set_current_run_id(self, run_id: str) -> None:
        self._current_run_id = run_id

    @property
    def current_run_id(self) -> str | None:
        return self._current_run_id

    @property
    def user_agent(self) -> str:
        return f'W&B Internal Client {lumina.__version__}'

    @property
    def api_key(self) -> str | None:
        from lumina.sdk.lib import wbauth
        if (auth := wbauth.session_credentials(host=self.api_url)) and isinstance(auth, wbauth.AuthApiKey):
            return auth.api_key
        return os.getenv(env.API_KEY) or wbauth.read_netrc_auth(host=self.api_url) or parse_sm_secrets().get(env.API_KEY) or self.default_settings.get('api_key')

    @property
    def access_token(self) -> str | None:
        """Retrieves an access token for authentication.

        This function attempts to exchange an identity token for a temporary
        access token from the server, and save it to the credentials file.
        It uses the path to the identity token as defined in the environment
        variables. If the environment variable is not set, it returns None.

        Returns:
            str | None: The access token if available, otherwise None if
            no identity token is supplied.
        Raises:
            AuthenticationError: If the path to the identity token is not found.
        """
        token_file_str = self._environ.get(env.IDENTITY_TOKEN_FILE)
        if not token_file_str:
            return None
        token_file = Path(token_file_str)
        if not token_file.exists():
            raise AuthenticationError(f'Identity token file not found: {token_file}')
        auth = wbauth.AuthIdentityTokenFile(host=self.settings('base_url'), path=str(token_file), credentials_file=wandb_setup.singleton().settings.credentials_file)
        return auth.fetch_access_token()

    @property
    def api_url(self) -> str:
        return self.settings('base_url')

    @property
    def app_url(self) -> str:
        return lumina.util.app_url(self.api_url)

    @property
    def default_entity(self) -> str:
        return self.viewer().get('entity')

    @overload
    def settings(self, key: None=None) -> dict[str, Any]:
        ...

    @overload
    def settings(self, key: str) -> Any:
        ...

    def settings(self, key: str | None=None) -> Any:
        """The settings overridden from the wandb/settings file.

        Args:
            key (str, optional): If provided only this setting is returned
            section (str, optional): If provided this section of the setting file is
            used, defaults to "default"

        Returns:
            A dict with the current settings

                {
                    "entity": "models",
                    "base_url": "https://api.wandb.ai",
                    "project": None,
                    "organization": "my-org",
                }
        """
        result: dict[str, Any] = dict(self.default_settings)
        result.update(self._settings)
        result.update({'entity': env.get_entity(self._settings.get('entity', result.get('entity')), env=self._environ), 'organization': env.get_organization(self._settings.get('organization', result.get('organization')), env=self._environ), 'project': env.get_project(self._settings.get('project', result.get('project')), env=self._environ), 'base_url': env.get_base_url(self._settings.get('base_url', result.get('base_url')), env=self._environ)})
        return result if key is None else result[key]

    def clear_setting(self, key: str) -> None:
        self._settings.pop(key, None)

    def set_setting(self, key: str, value: Any) -> None:
        self._settings[key] = value
        if key == 'entity':
            env.set_entity(value, env=self._environ)
        elif key == 'project':
            env.set_project(value, env=self._environ)
        elif key == 'base_url':
            self.relocate()

    def parse_slug(self, slug: str, project: str | None=None, run: str | None=None) -> tuple[str, str]:
        """Parse a slug into a project and run.

        Args:
            slug (str): The slug to parse
            project (str, optional): The project to use, if not provided it will be
            inferred from the slug
            run (str, optional): The run to use, if not provided it will be inferred
            from the slug

        Returns:
            A dict with the project and run
        """
        if slug and '/' in slug:
            parts = slug.split('/')
            project = parts[0]
            run = parts[1]
        else:
            project = project or self.settings().get('project')
            if project is None:
                raise CommError('No default project configured.')
            run = run or slug or self.current_run_id or env.get_run(env=self._environ)
            assert run, 'run must be specified'
        return (project, run)

    @normalize_exceptions
    def fail_run_queue_item(self, run_queue_item_id: str, message: str, stage: str, file_paths: list[str] | None=None) -> bool:
        variables: dict[str, str | (list[str] | None)] = {'runQueueItemId': run_queue_item_id, 'message': message, 'stage': stage}
        if file_paths is not None:
            variables['filePaths'] = file_paths
        mutation_string = '\n        mutation failRunQueueItem($runQueueItemId: ID!, $message: String!, $stage: String!, $filePaths: [String!]) {\n            failRunQueueItem(\n                input: {\n                    runQueueItemId: $runQueueItemId\n                    message: $message\n                    stage: $stage\n                    filePaths: $filePaths\n                }\n            ) {\n                success\n            }\n        }\n        '
        mutation = mutation_string
        response = self.execute(mutation, variables=variables)
        result: bool = response['failRunQueueItem']['success']
        return result

    def _server_features(self) -> dict[str, bool]:
        query = SERVER_FEATURES_QUERY_GQL
        try:
            response = self.execute(query)
        except Exception as e:
            if 'Cannot query field "features" on type "ServerInfo".' in str(e):
                self._server_features_cache = {}
            else:
                raise
        else:
            info = ServerFeaturesQuery.model_validate(response).server_info
            if info and (feats := info.features):
                self._server_features_cache = {f.name: f.is_enabled for f in feats if f}
            else:
                self._server_features_cache = {}
        return self._server_features_cache

    def _server_supports(self, feature: int | str) -> bool:
        """Return whether the current server supports the given feature.

        NOTE: This is deprecated. Outside of this file, please use
        `ServiceApi.feature_enabled()`. The `ServiceApi` is a sort of
        replacement to this "internal" `Api` class.

        This also caches the underlying lookup of server feature flags,
        and it maps {feature_name (str) -> is_enabled (bool)}.

        Good to use for features that have a fallback mechanism for older servers.
        """
        key = ServerFeature.Name(feature) if isinstance(feature, int) else feature
        return self._server_features().get(key) or False

    @normalize_exceptions
    def update_run_queue_item_warning(self, run_queue_item_id: str, message: str, stage: str, file_paths: list[str] | None=None) -> bool:
        mutation = '\n        mutation updateRunQueueItemWarning($runQueueItemId: ID!, $message: String!, $stage: String!, $filePaths: [String!]) {\n            updateRunQueueItemWarning(\n                input: {\n                    runQueueItemId: $runQueueItemId\n                    message: $message\n                    stage: $stage\n                    filePaths: $filePaths\n                }\n            ) {\n                success\n            }\n        }\n        '
        response = self.execute(mutation, variables={'runQueueItemId': run_queue_item_id, 'message': message, 'stage': stage, 'filePaths': file_paths})
        result: bool = response['updateRunQueueItemWarning']['success']
        return result

    @normalize_exceptions
    def viewer(self) -> dict[str, Any]:
        query = '\n        query Viewer{\n            viewer {\n                id\n                entity\n                username\n                flags\n                teams {\n                    edges {\n                        node {\n                            name\n                        }\n                    }\n                }\n            }\n        }\n        '
        res = self.execute(query)
        return res.get('viewer') or {}

    @normalize_exceptions
    def max_cli_version(self) -> str | None:
        if self._max_cli_version is not None:
            return self._max_cli_version
        _, server_info = self.viewer_server_info()
        self._max_cli_version = server_info.get('cliVersionInfo', {}).get('max_cli_version')
        return self._max_cli_version

    @normalize_exceptions
    def viewer_server_info(self) -> tuple[dict[str, Any], dict[str, Any]]:
        query = '\n        query Viewer{\n            viewer {\n                id\n                entity\n                username\n                email\n                flags\n                teams {\n                    edges {\n                        node {\n                            name\n                        }\n                    }\n                }\n            }\n            serverInfo {\n                cliVersionInfo\n                latestLocalVersionInfo {\n                    outOfDate\n                    latestVersionString\n                    versionOnThisInstanceString\n                }\n            }\n        }\n        '
        res = self.execute(query)
        return (res.get('viewer') or {}, res.get('serverInfo') or {})

    @normalize_exceptions
    def list_projects(self, entity: str | None=None) -> list[dict[str, str]]:
        """List projects in W&B scoped by entity.

        Args:
            entity (str, optional): The entity to scope this project to.

        Returns:
                [{"id","name","description"}]
        """
        query = '\n        query EntityProjects($entity: String) {\n            models(first: 10, entityName: $entity) {\n                edges {\n                    node {\n                        id\n                        name\n                        description\n                    }\n                }\n            }\n        }\n        '
        project_list: list[dict[str, str]] = self._flatten_edges(self.execute(query, variables={'entity': entity or self.settings('entity')})['models'])
        return project_list

    @normalize_exceptions
    def project(self, project: str, entity: str | None=None) -> _Response:
        """Retrieve project.

        Args:
            project (str): The project to get details for
            entity (str, optional): The entity to scope this project to.

        Returns:
                [{"id","name","repo","dockerImage","description"}]
        """
        query = '\n        query ProjectDetails($entity: String, $project: String) {\n            model(name: $project, entityName: $entity) {\n                id\n                name\n                repo\n                dockerImage\n                description\n            }\n        }\n        '
        response: _Response = self.execute(query, variables={'entity': entity, 'project': project})['model']
        return response

    @normalize_exceptions
    def sweep(self, sweep: str, specs: str, project: str | None=None, entity: str | None=None) -> dict[str, Any]:
        """Retrieve sweep.

        Args:
            sweep (str): The sweep to get details for
            specs (str): history specs
            project (str, optional): The project to scope this sweep to.
            entity (str, optional): The entity to scope this sweep to.

        Returns:
                [{"id","name","repo","dockerImage","description"}]
        """
        query = '\n        query SweepWithRuns($entity: String, $project: String, $sweep: String!, $specs: [JSONString!]!) {\n            project(name: $project, entityName: $entity) {\n                sweep(sweepName: $sweep) {\n                    id\n                    name\n                    method\n                    state\n                    description\n                    config\n                    createdAt\n                    heartbeatAt\n                    updatedAt\n                    earlyStopJobRunning\n                    bestLoss\n                    controller\n                    scheduler\n                    runs {\n                        edges {\n                            node {\n                                name\n                                state\n                                config\n                                exitcode\n                                heartbeatAt\n                                shouldStop\n                                failed\n                                stopped\n                                running\n                                summaryMetrics\n                                sampledHistory(specs: $specs)\n                            }\n                        }\n                    }\n                }\n            }\n        }\n        '
        entity = entity or self.settings('entity')
        project = project or self.settings('project')
        response = self.execute(query, variables={'entity': entity, 'project': project, 'sweep': sweep, 'specs': specs})
        if response['project'] is None or response['project']['sweep'] is None:
            raise ValueError(f'Sweep {entity}/{project}/{sweep} not found')
        data: dict[str, Any] = response['project']['sweep']
        if data:
            data['runs'] = self._flatten_edges(data['runs'])
        return data

    @normalize_exceptions
    def list_runs(self, project: str, entity: str | None=None) -> list[dict[str, str]]:
        """List runs in W&B scoped by project.

        Args:
            project (str): The project to scope the runs to
            entity (str, optional): The entity to scope this project to.  Defaults to public models

        Returns:
                [{"id","name","description"}]
        """
        query = '\n        query ProjectRuns($model: String!, $entity: String) {\n            model(name: $model, entityName: $entity) {\n                buckets(first: 10) {\n                    edges {\n                        node {\n                            id\n                            name\n                            displayName\n                            description\n                        }\n                    }\n                }\n            }\n        }\n        '
        return self._flatten_edges(self.execute(query, variables={'entity': entity or self.settings('entity'), 'model': project or self.settings('project')})['model']['buckets'])

    @normalize_exceptions
    def run_config(self, project: str, run: str | None=None, entity: str | None=None) -> tuple[str, dict[str, Any], str | None, dict[str, Any]]:
        """Get the relevant configs for a run.

        Args:
            project (str): The project to download, (can include bucket)
            run (str, optional): The run to download
            entity (str, optional): The entity to scope this project to.
        """
        query = '\n        query RunConfigs(\n            $name: String!,\n            $entity: String,\n            $run: String!,\n            $pattern: String!,\n            $includeConfig: Boolean!,\n        ) {\n            model(name: $name, entityName: $entity) {\n                bucket(name: $run) {\n                    config @include(if: $includeConfig)\n                    commit @include(if: $includeConfig)\n                    files(pattern: $pattern) {\n                        pageInfo {\n                            hasNextPage\n                            endCursor\n                        }\n                        edges {\n                            node {\n                                name\n                                directUrl\n                            }\n                        }\n                    }\n                }\n            }\n        }\n        '
        variables = {'name': project, 'run': run, 'entity': entity, 'includeConfig': True}
        commit: str = ''
        config: dict[str, Any] = {}
        patch: str | None = None
        metadata: dict[str, Any] = {}
        with tempfile.TemporaryDirectory() as tmpdir:
            for filename in [DIFF_FNAME, METADATA_FNAME]:
                variables['pattern'] = filename
                response = self.execute(query, variables=variables)
                if response['model'] is None:
                    raise CommError(f'Run {entity}/{project}/{run} not found')
                run_obj: dict = response['model']['bucket']
                if variables['includeConfig']:
                    commit = run_obj['commit']
                    config = json.loads(run_obj['config'] or '{}')
                    variables['includeConfig'] = False
                if run_obj['files'] is not None:
                    for file_edge in run_obj['files']['edges']:
                        name = file_edge['node']['name']
                        url = file_edge['node']['directUrl']
                        path = Path(tmpdir, name)
                        self.download_file(url, str(path))
                        if name == METADATA_FNAME:
                            with path.open(encoding='utf-8') as file:
                                metadata = json.load(file)
                        elif name == DIFF_FNAME:
                            patch = path.read_text(encoding='utf-8')
        return (commit, config, patch, metadata)

    @normalize_exceptions
    def run_resume_status(self, entity: str, project_name: str, name: str) -> dict[str, Any] | None:
        """Check if a run exists and get resume information.

        Args:
            entity (str): The entity to scope this project to.
            project_name (str): The project to download, (can include bucket)
            name (str): The run to download
        """
        query = '\n        query RunResumeStatus($project: String, $entity: String, $name: String!) {\n            model(name: $project, entityName: $entity) {\n                id\n                name\n                entity {\n                    id\n                    name\n                }\n\n                bucket(name: $name, missingOk: true) {\n                    id\n                    name\n                    summaryMetrics\n                    displayName\n                    logLineCount\n                    historyLineCount\n                    eventsLineCount\n                    historyTail\n                    eventsTail\n                    config\n                    tags\n                    wandbConfig(keys: ["t"])\n                }\n            }\n        }\n        '
        response = self.execute(query, variables={'entity': entity, 'project': project_name, 'name': name})
        if 'model' not in response or 'bucket' not in (response['model'] or {}):
            return None
        project = response['model']
        self.set_setting('project', project_name)
        if 'entity' in project:
            self.set_setting('entity', project['entity']['name'])
        result: dict[str, Any] = project['bucket']
        return result

    @normalize_exceptions
    def check_stop_requested(self, project_name: str, entity_name: str, run_id: str) -> bool:
        query = '\n        query RunStoppedStatus($projectName: String, $entityName: String, $runId: String!) {\n            project(name:$projectName, entityName:$entityName) {\n                run(name:$runId) {\n                    stopped\n                }\n            }\n        }\n        '
        response = self.execute(query, variables={'projectName': project_name, 'entityName': entity_name, 'runId': run_id})
        project = response.get('project', None)
        if not project:
            return False
        run = project.get('run', None)
        if not run:
            return False
        status: bool = run['stopped']
        return status

    def format_project(self, project: str) -> str:
        return re.sub('\\W+', '-', project.lower()).strip('-_')

    @normalize_exceptions
    def upsert_project(self, project: str, id: str | None=None, description: str | None=None, entity: str | None=None) -> dict[str, Any]:
        """Create a new project.

        Args:
            project (str): The project to create
            description (str, optional): A description of this project
            entity (str, optional): The entity to scope this project to.
        """
        mutation = '\n        mutation UpsertModel($name: String!, $id: String, $entity: String!, $description: String, $repo: String)  {\n            upsertModel(input: { id: $id, name: $name, entityName: $entity, description: $description, repo: $repo }) {\n                model {\n                    name\n                    description\n                }\n            }\n        }\n        '
        response = self.execute(mutation, variables={'name': self.format_project(project), 'entity': entity or self.settings('entity'), 'description': description, 'id': id})
        result: dict[str, Any] = response['upsertModel']['model']
        return result

    @normalize_exceptions
    def entity_is_team(self, entity: str) -> bool:
        query = '\n            query EntityIsTeam($entity: String!) {\n                entity(name: $entity) {\n                    id\n                    isTeam\n                }\n            }\n            '
        variables = {'entity': entity}
        res = self.execute(query, variables)
        if res.get('entity') is None:
            raise Exception(f'Error fetching entity {entity} check that you have access to this entity')
        is_team: bool = res['entity']['isTeam']
        return is_team

    @normalize_exceptions
    def get_project_run_queues(self, entity: str, project: str) -> list[dict[str, str]]:
        query = '\n        query ProjectRunQueues($entity: String!, $projectName: String!){\n            project(entityName: $entity, name: $projectName) {\n                runQueues {\n                    id\n                    name\n                    createdBy\n                    access\n                }\n            }\n        }\n        '
        variables = {'projectName': project, 'entity': entity}
        res = self.execute(query, variables)
        if res.get('project') is None:
            if project == 'model-registry':
                msg = f'Error fetching run queues for {entity} check that you have access to this entity and project'
            else:
                msg = f'Error fetching run queues for {entity}/{project} check that you have access to this entity and project'
            raise Exception(msg)
        project_run_queues: list[dict[str, str]] = res['project']['runQueues']
        return project_run_queues

    @normalize_exceptions
    def create_default_resource_config(self, entity: str, resource: str, config: str, template_variables: dict[str, float | int | str] | None) -> dict[str, Any] | None:
        mutation_params = '\n            $entityName: String!,\n            $resource: String!,\n            $config: JSONString!,\n            $templateVariables: JSONString\n        '
        mutation_inputs = '\n            entityName: $entityName,\n            resource: $resource,\n            config: $config,\n            templateVariables: $templateVariables\n        '
        variables = {'entityName': entity, 'resource': resource, 'config': config}
        if template_variables is not None:
            variables['templateVariables'] = json.dumps(template_variables)
        else:
            variables['templateVariables'] = '{}'
        query = f'\n        mutation createDefaultResourceConfig(\n            {mutation_params}\n        ) {{\n            createDefaultResourceConfig(\n            input: {{\n                {mutation_inputs}\n            }}\n            ) {{\n            defaultResourceConfigID\n            success\n            }}\n        }}\n        '
        result: dict[str, Any] | None = self.execute(query, variables)['createDefaultResourceConfig']
        return result

    @normalize_exceptions
    def create_run_queue(self, entity: str, project: str, queue_name: str, access: str, prioritization_mode: str | None=None, config_id: str | None=None) -> dict[str, Any] | None:
        query = '\n        mutation createRunQueue(\n            $entity: String!,\n            $project: String!,\n            $queueName: String!,\n            $access: RunQueueAccessType!,\n            $prioritizationMode: RunQueuePrioritizationMode,\n            $defaultResourceConfigID: ID,\n        ) {\n            createRunQueue(\n                input: {\n                    entityName: $entity,\n                    projectName: $project,\n                    queueName: $queueName,\n                    access: $access,\n                    prioritizationMode: $prioritizationMode\n                    defaultResourceConfigID: $defaultResourceConfigID\n                }\n            ) {\n                success\n                queueID\n            }\n        }\n        '
        variables = {'entity': entity, 'project': project, 'queueName': queue_name, 'access': access, 'prioritizationMode': prioritization_mode, 'defaultResourceConfigID': config_id}
        result: dict[str, Any] | None = self.execute(query, variables)['createRunQueue']
        return result

    @normalize_exceptions
    def upsert_run_queue(self, queue_name: str, entity: str, resource_type: str, resource_config: dict, project: str=LAUNCH_DEFAULT_PROJECT, prioritization_mode: str | None=None, template_variables: dict | None=None, external_links: dict | None=None) -> dict[str, Any] | None:
        query = '\n            mutation upsertRunQueue(\n                $entityName: String!\n                $projectName: String!\n                $queueName: String!\n                $resourceType: String!\n                $resourceConfig: JSONString!\n                $templateVariables: JSONString\n                $prioritizationMode: RunQueuePrioritizationMode\n                $externalLinks: JSONString\n                $clientMutationId: String\n            ) {\n                upsertRunQueue(\n                    input: {\n                        entityName: $entityName\n                        projectName: $projectName\n                        queueName: $queueName\n                        resourceType: $resourceType\n                        resourceConfig: $resourceConfig\n                        templateVariables: $templateVariables\n                        prioritizationMode: $prioritizationMode\n                        externalLinks: $externalLinks\n                        clientMutationId: $clientMutationId\n                    }\n                ) {\n                    success\n                    configSchemaValidationErrors\n                }\n            }\n            '
        variables = {'entityName': entity, 'projectName': project, 'queueName': queue_name, 'resourceType': resource_type, 'resourceConfig': json.dumps(resource_config), 'templateVariables': json.dumps(template_variables) if template_variables else None, 'prioritizationMode': prioritization_mode, 'externalLinks': json.dumps(external_links) if external_links else None}
        result: _Response = self.execute(query, variables)
        return result['upsertRunQueue']

    @normalize_exceptions
    def push_to_run_queue_by_name(self, entity: str, project: str, queue_name: str, run_spec: str, template_variables: dict[str, int | float | str] | None, priority: int | None=None) -> dict[str, Any] | None:
        mutation_params = '\n            $entityName: String!,\n            $projectName: String!,\n            $queueName: String!,\n            $runSpec: JSONString!\n        '
        mutation_input = '\n            entityName: $entityName,\n            projectName: $projectName,\n            queueName: $queueName,\n            runSpec: $runSpec\n        '
        variables: dict[str, Any] = {'entityName': entity, 'projectName': project, 'queueName': queue_name, 'runSpec': run_spec}
        if priority is not None:
            variables['priority'] = priority
            mutation_params += ', $priority: Int'
            mutation_input += ', priority: $priority'
        if template_variables is not None:
            variables.update({'templateVariableValues': json.dumps(template_variables)})
            mutation_params += ', $templateVariableValues: JSONString'
            mutation_input += ', templateVariableValues: $templateVariableValues'
        mutation = f'\n        mutation pushToRunQueueByName(\n          {mutation_params}\n        ) {{\n            pushToRunQueueByName(\n                input: {{\n                    {mutation_input}\n                }}\n            ) {{\n                runQueueItemId\n                runSpec\n            }}\n        }}\n        '
        try:
            result: dict[str, Any] | None = self.execute(mutation, variables).get('pushToRunQueueByName')
            if not result:
                return None
            if result.get('runSpec'):
                run_spec = json.loads(str(result['runSpec']))
                result['runSpec'] = run_spec
            return result
        except Exception as e:
            if 'Cannot query field "runSpec" on type "PushToRunQueueByNamePayload"' not in str(e):
                return None
        mutation_no_runspec = '\n        mutation pushToRunQueueByName(\n            $entityName: String!,\n            $projectName: String!,\n            $queueName: String!,\n            $runSpec: JSONString!,\n        ) {\n            pushToRunQueueByName(\n                input: {\n                    entityName: $entityName,\n                    projectName: $projectName,\n                    queueName: $queueName,\n                    runSpec: $runSpec\n                }\n            ) {\n                runQueueItemId\n            }\n        }\n        '
        try:
            result = self.execute(mutation_no_runspec, variables).get('pushToRunQueueByName')
        except Exception:
            result = None
        return result

    @normalize_exceptions
    def push_to_run_queue(self, queue_name: str, launch_spec: dict[str, str], template_variables: dict | None, project_queue: str, priority: int | None=None) -> dict[str, Any] | None:
        entity = launch_spec.get('queue_entity') or launch_spec['entity']
        run_spec = json.dumps(launch_spec)
        push_result = self.push_to_run_queue_by_name(entity, project_queue, queue_name, run_spec, template_variables, priority)
        if push_result:
            return push_result
        if priority is not None:
            return None
        ' Legacy Method '
        queues_found = self.get_project_run_queues(entity, project_queue)
        matching_queues = [q for q in queues_found if q['name'] == queue_name and (q['access'] in ['PROJECT', 'USER'] or q['createdBy'] == self.default_entity)]
        if not matching_queues:
            if queue_name == 'default':
                lumina.termlog(f'No default queue existing for entity: {entity} in project: {project_queue}, creating one.')
                res = self.create_run_queue(launch_spec['entity'], project_queue, queue_name, access='PROJECT')
                if res is None or res.get('queueID') is None:
                    lumina.termerror(f'Unable to create default queue for entity: {entity} on project: {project_queue}. Run could not be added to a queue')
                    return None
                queue_id = res['queueID']
            else:
                if project_queue == 'model-registry':
                    _msg = f'Unable to push to run queue {queue_name}. Queue not found.'
                else:
                    _msg = f'Unable to push to run queue {project_queue}/{queue_name}. Queue not found.'
                lumina.termwarn(_msg)
                return None
        elif len(matching_queues) > 1:
            lumina.termerror(f'Unable to push to run queue {queue_name}. More than one queue found with this name.')
            return None
        else:
            queue_id = matching_queues[0]['id']
        spec_json = json.dumps(launch_spec)
        variables = {'queueID': queue_id, 'runSpec': spec_json}
        mutation_params = '\n            $queueID: ID!,\n            $runSpec: JSONString!\n        '
        mutation_input = '\n            queueID: $queueID,\n            runSpec: $runSpec\n        '
        if template_variables is not None:
            mutation_params += ', $templateVariableValues: JSONString'
            mutation_input += ', templateVariableValues: $templateVariableValues'
            variables.update({'templateVariableValues': json.dumps(template_variables)})
        mutation = f'\n        mutation pushToRunQueue(\n            {mutation_params}\n            ) {{\n            pushToRunQueue(\n                input: {{{mutation_input}}}\n            ) {{\n                runQueueItemId\n            }}\n        }}\n        '
        response = self.execute(mutation, variables=variables)
        if not response.get('pushToRunQueue'):
            raise CommError(f'Error pushing run queue item to queue {queue_name}.')
        result: dict[str, Any] | None = response['pushToRunQueue']
        return result

    @normalize_exceptions
    def pop_from_run_queue(self, queue_name: str, entity: str | None=None, project: str | None=None, agent_id: str | None=None) -> dict[str, Any] | None:
        mutation = '\n        mutation popFromRunQueue($entity: String!, $project: String!, $queueName: String!, $launchAgentId: ID)  {\n            popFromRunQueue(input: {\n                entityName: $entity,\n                projectName: $project,\n                queueName: $queueName,\n                launchAgentId: $launchAgentId\n            }) {\n                runQueueItemId\n                runSpec\n            }\n        }\n        '
        response = self.execute(mutation, variables={'entity': entity, 'project': project, 'queueName': queue_name, 'launchAgentId': agent_id})
        result: dict[str, Any] | None = response['popFromRunQueue']
        return result

    @normalize_exceptions
    def ack_run_queue_item(self, item_id: str, run_id: str | None=None) -> bool:
        mutation = '\n        mutation ackRunQueueItem($itemId: ID!, $runId: String!)  {\n            ackRunQueueItem(input: { runQueueItemId: $itemId, runName: $runId }) {\n                success\n            }\n        }\n        '
        response = self.execute(mutation, variables={'itemId': item_id, 'runId': str(run_id)})
        if not response['ackRunQueueItem']['success']:
            raise CommError('Error acking run queue item. Item may have already been acknowledged by another process')
        result: bool = response['ackRunQueueItem']['success']
        return result

    @normalize_exceptions
    def create_launch_agent(self, entity: str, project: str, queues: list[str], agent_config: dict[str, Any], version: str) -> dict:
        project_queues = self.get_project_run_queues(entity, project)
        if not project_queues:
            default = self.create_run_queue(entity, project, 'default', access='PROJECT')
            if default is None or default.get('queueID') is None:
                raise CommError(f'Unable to create default queue for {entity}/{project}. No queues for agent to poll')
            project_queues = [{'id': default['queueID'], 'name': 'default'}]
        polling_queue_ids = [q['id'] for q in project_queues if q['name'] in queues]
        if len(polling_queue_ids) != len(queues):
            raise CommError(f"Could not start launch agent: Not all of requested queues ({', '.join(queues)}) found. Available queues for this project: {','.join([q['name'] for q in project_queues])}")
        hostname = socket.gethostname()
        variables = {'entity': entity, 'project': project, 'queues': polling_queue_ids, 'hostname': hostname, 'agentConfig': json.dumps(agent_config), 'version': version}
        mutation_params = '\n            $entity: String!,\n            $project: String!,\n            $queues: [ID!]!,\n            $hostname: String!,\n            $agentConfig: JSONString,\n            $version: String\n        '
        mutation_input = '\n            entityName: $entity,\n            projectName: $project,\n            runQueues: $queues,\n            hostname: $hostname,\n            agentConfig: $agentConfig,\n            version: $version\n        '
        mutation = f'\n            mutation createLaunchAgent(\n                {mutation_params}\n            ) {{\n                createLaunchAgent(\n                    input: {{\n                        {mutation_input}\n                    }}\n                ) {{\n                    launchAgentId\n                }}\n            }}\n            '
        result: dict = self.execute(mutation, variables)['createLaunchAgent']
        return result

    @normalize_exceptions
    def update_launch_agent_status(self, agent_id: str, status: str) -> dict:
        mutation = '\n            mutation updateLaunchAgent($agentId: ID!, $agentStatus: String){\n                updateLaunchAgent(\n                    input: {\n                        launchAgentId: $agentId\n                        agentStatus: $agentStatus\n                    }\n                ) {\n                    success\n                }\n            }\n            '
        variables = {'agentId': agent_id, 'agentStatus': status}
        result: dict = self.execute(mutation, variables)['updateLaunchAgent']
        return result

    @normalize_exceptions
    def get_launch_agent(self, agent_id: str) -> dict:
        query = '\n            query LaunchAgent($agentId: ID!) {\n                launchAgent(id: $agentId) {\n                    id\n                    name\n                    runQueues\n                    hostname\n                    agentStatus\n                    stopPolling\n                    heartbeatAt\n                }\n            }\n            '
        variables = {'agentId': agent_id}
        result: dict = self.execute(query, variables)['launchAgent']
        return result

    @normalize_exceptions
    def upsert_run(self, id: str | None=None, name: str | None=None, project: str | None=None, host: str | None=None, group: str | None=None, tags: list[str] | None=None, config: dict | None=None, description: str | None=None, entity: str | None=None, state: str | None=None, display_name: str | None=None, notes: str | None=None, repo: str | None=None, job_type: str | None=None, program_path: str | None=None, commit: str | None=None, sweep_name: str | None=None, summary_metrics: str | None=None, num_retries: int | None=None) -> tuple[dict, bool]:
        """Update a run.

        Args:
            id (str, optional): The existing run to update
            name (str, optional): The name of the run to create
            group (str, optional): Name of the group this run is a part of
            project (str, optional): The name of the project
            host (str, optional): The name of the host
            tags (list, optional): A list of tags to apply to the run
            config (dict, optional): The latest config params
            description (str, optional): A description of this project
            entity (str, optional): The entity to scope this project to.
            display_name (str, optional): The display name of this project
            notes (str, optional): Notes about this run
            repo (str, optional): Url of the program's repository.
            state (str, optional): State of the program.
            job_type (str, optional): Type of job, e.g 'train'.
            program_path (str, optional): Path to the program.
            commit (str, optional): The Git SHA to associate the run with
            sweep_name (str, optional): The name of the sweep this run is a part of
            summary_metrics (str, optional): The JSON summary metrics
            num_retries (int, optional): Number of retries
        """
        query_string = '\n        mutation UpsertBucket(\n            $id: String,\n            $name: String,\n            $project: String,\n            $entity: String,\n            $groupName: String,\n            $description: String,\n            $displayName: String,\n            $notes: String,\n            $commit: String,\n            $config: JSONString,\n            $host: String,\n            $debug: Boolean,\n            $program: String,\n            $repo: String,\n            $jobType: String,\n            $state: String,\n            $sweep: String,\n            $tags: [String!],\n            $summaryMetrics: JSONString,\n        ) {\n            upsertBucket(input: {\n                id: $id,\n                name: $name,\n                groupName: $groupName,\n                modelName: $project,\n                entityName: $entity,\n                description: $description,\n                displayName: $displayName,\n                notes: $notes,\n                config: $config,\n                commit: $commit,\n                host: $host,\n                debug: $debug,\n                jobProgram: $program,\n                jobRepo: $repo,\n                jobType: $jobType,\n                state: $state,\n                sweep: $sweep,\n                tags: $tags,\n                summaryMetrics: $summaryMetrics,\n            }) {\n                bucket {\n                    id\n                    name\n                    displayName\n                    description\n                    config\n                    sweepName\n                    project {\n                        id\n                        name\n                        entity {\n                            id\n                            name\n                        }\n                    }\n                    historyLineCount\n                }\n                inserted\n            }\n        }\n        '
        mutation = query_string
        config_str = json.dumps(config) if config else None
        if not description or description.isspace():
            description = None
        variables = {'id': id, 'entity': entity or self.settings('entity'), 'name': name, 'project': project or util.auto_project_name(program_path), 'groupName': group, 'tags': tags, 'description': description, 'config': config_str, 'commit': commit, 'displayName': display_name, 'notes': notes, 'host': None if self.settings().get('anonymous') in ['allow', 'must'] else host, 'debug': env.is_debug(env=self._environ), 'repo': repo, 'program': program_path, 'jobType': job_type, 'state': state, 'sweep': sweep_name, 'summaryMetrics': summary_metrics}
        response = self.execute(mutation, variables=variables)
        run_obj: dict[str, dict[str, dict[str, str]]] = response['upsertBucket']['bucket']
        project_obj: dict[str, dict[str, str]] = run_obj.get('project', {})
        if project_obj:
            self.set_setting('project', project_obj['name'])
            entity_obj = project_obj.get('entity', {})
            if entity_obj:
                self.set_setting('entity', entity_obj['name'])
        return (response['upsertBucket']['bucket'], response['upsertBucket']['inserted'])

    @normalize_exceptions
    def rewind_run(self, run_name: str, metric_name: str, metric_value: float, program_path: str | None=None, entity: str | None=None, project: str | None=None, num_retries: int | None=None) -> dict:
        """Rewinds a run to a previous state.

        Args:
            run_name (str): The name of the run to rewind
            metric_name (str): The name of the metric to rewind to
            metric_value (float): The value of the metric to rewind to
            program_path (str, optional): Path to the program
            entity (str, optional): The entity to scope this project to
            project (str, optional): The name of the project
            num_retries (int, optional): Number of retries

        Returns:
            A dict with the rewound run

                {
                    "id": "run_id",
                    "name": "run_name",
                    "displayName": "run_display_name",
                    "description": "run_description",
                    "config": "stringified_run_config_json",
                    "sweepName": "run_sweep_name",
                    "project": {
                        "id": "project_id",
                        "name": "project_name",
                        "entity": {
                            "id": "entity_id",
                            "name": "entity_name"
                        }
                    },
                    "historyLineCount": 100,
                }
        """
        query_string = '\n        mutation RewindRun($runName: String!, $entity: String, $project: String, $metricName: String!, $metricValue: Float!) {\n            rewindRun(input: {runName: $runName, entityName: $entity, projectName: $project, metricName: $metricName, metricValue: $metricValue}) {\n                rewoundRun {\n                    id\n                    name\n                    displayName\n                    description\n                    config\n                    sweepName\n                    project {\n                        id\n                        name\n                        entity {\n                            id\n                            name\n                        }\n                    }\n                    historyLineCount\n                }\n            }\n        }\n        '
        mutation = query_string
        variables = {'runName': run_name, 'entity': entity or self.settings('entity'), 'project': project or util.auto_project_name(program_path), 'metricName': metric_name, 'metricValue': metric_value}
        response = self.execute(mutation, variables=variables)
        run_obj: dict[str, dict[str, dict[str, str]]] = response.get('rewindRun', {}).get('rewoundRun', {})
        project_obj: dict[str, dict[str, str]] = run_obj.get('project', {})
        if project_obj:
            self.set_setting('project', project_obj['name'])
            entity_obj = project_obj.get('entity', {})
            if entity_obj:
                self.set_setting('entity', entity_obj['name'])
        return run_obj

    @normalize_exceptions
    def get_run_info(self, entity: str, project: str, name: str) -> dict:
        query = '\n        query RunInfo($project: String!, $entity: String!, $name: String!) {\n            project(name: $project, entityName: $entity) {\n                run(name: $name) {\n                    runInfo {\n                        program\n                        args\n                        os\n                        python\n                        colab\n                        executable\n                        codeSaved\n                        cpuCount\n                        gpuCount\n                        gpu\n                        git {\n                            remote\n                            commit\n                        }\n                    }\n                }\n            }\n        }\n        '
        variables = {'project': project, 'entity': entity, 'name': name}
        res = self.execute(query, variables)
        if res.get('project') is None:
            raise CommError(f'Error fetching run info for {entity}/{project}/{name}. Check that this project exists and you have access to this entity and project')
        elif res['project'].get('run') is None:
            raise CommError(f'Error fetching run info for {entity}/{project}/{name}. Check that this run id exists')
        run_info: dict = res['project']['run']['runInfo']
        return run_info

    @normalize_exceptions
    def get_run_state(self, entity: str, project: str, name: str) -> str:
        query = '\n        query RunState(\n            $project: String!,\n            $entity: String!,\n            $name: String!) {\n            project(name: $project, entityName: $entity) {\n                run(name: $name) {\n                    state\n                }\n            }\n        }\n        '
        variables = {'project': project, 'entity': entity, 'name': name}
        res = self.execute(query, variables)
        if res.get('project') is None or res['project'].get('run') is None:
            raise CommError(f'Error fetching run state for {entity}/{project}/{name}.')
        run_state: str = res['project']['run']['state']
        return run_state

    @normalize_exceptions
    def upload_urls(self, project: str, files: list[str] | dict[str, IO], run: str | None=None, entity: str | None=None, description: str | None=None) -> tuple[str, list[str], dict[str, dict[str, Any]]]:
        """Generate temporary resumable upload urls.

        Args:
            project (str): The project to download
            files (list or dict): The filenames to upload
            run (str, optional): The run to upload to
            entity (str, optional): The entity to scope this project to.
            description (str, optional): description

        Returns:
            (run_id, upload_headers, file_info)
            run_id: id of run we uploaded files to
            upload_headers: A list of headers to use when uploading files.
            file_info: A dict of filenames and urls.
                {
                    "run_id": "run_id",
                    "upload_headers": [""],
                    "file_info":  [
                        { "weights.h5": { "uploadUrl": "https://weights.url" } },
                        { "model.json": { "uploadUrl": "https://model.json" } }
                    ]
                }
        """
        run_name = run or self.current_run_id
        assert run_name, 'run must be specified'
        entity = entity or self.settings('entity')
        assert entity, 'entity must be specified'
        query = '\n        mutation CreateRunFiles($entity: String!, $project: String!, $run: String!, $files: [String!]!) {\n            createRunFiles(input: {entityName: $entity, projectName: $project, runName: $run, files: $files}) {\n                runID\n                uploadHeaders\n                files {\n                    name\n                    uploadUrl\n                }\n            }\n        }\n        '
        query_result = self.execute(query, variables={'project': project, 'run': run_name, 'entity': entity, 'files': [file for file in files]})
        result = query_result['createRunFiles']
        run_id = result['runID']
        if not run_id:
            raise CommError(f'Error uploading files to {entity}/{project}/{run_name}. Check that this project exists and you have access to this entity and project')
        file_name_urls = {file['name']: file for file in result['files']}
        return (run_id, result['uploadHeaders'], file_name_urls)

    def legacy_upload_urls(self, project: str, files: list[str] | dict[str, IO], run: str | None=None, entity: str | None=None, description: str | None=None) -> tuple[str, list[str], dict[str, dict[str, Any]]]:
        """Generate temporary resumable upload urls.

        A new mutation createRunFiles was introduced after 0.15.4.
        This function is used to support older versions.
        """
        query = '\n        query RunUploadUrls($name: String!, $files: [String]!, $entity: String, $run: String!, $description: String) {\n            model(name: $name, entityName: $entity) {\n                bucket(name: $run, desc: $description) {\n                    id\n                    files(names: $files) {\n                        uploadHeaders\n                        edges {\n                            node {\n                                name\n                                url(upload: true)\n                                updatedAt\n                            }\n                        }\n                    }\n                }\n            }\n        }\n        '
        run_id = run or self.current_run_id
        assert run_id, 'run must be specified'
        entity = entity or self.settings('entity')
        query_result = self.execute(query, variables={'name': project, 'run': run_id, 'entity': entity, 'files': [file for file in files], 'description': description})
        run_obj = query_result['model']['bucket']
        if run_obj:
            for file_node in run_obj['files']['edges']:
                file = file_node['node']
                if 'url' in file and 'uploadUrl' not in file:
                    file['uploadUrl'] = file.pop('url')
            result = {file['name']: file for file in self._flatten_edges(run_obj['files'])}
            return (run_obj['id'], run_obj['files']['uploadHeaders'], result)
        else:
            raise CommError(f'Run does not exist {entity}/{project}/{run_id}.')

    @normalize_exceptions
    def download_urls(self, project: str, run: str | None=None, entity: str | None=None) -> dict[str, dict[str, str]]:
        """Generate download urls.

        Args:
            project (str): The project to download
            run (str): The run to upload to
            entity (str, optional): The entity to scope this project to.  Defaults to wandb models

        Returns:
            A dict of extensions and urls

                {
                    'weights.h5': { "url": "https://weights.url", "updatedAt": '2013-04-26T22:22:23.832Z', 'md5': 'mZFLkyvTelC5g8XnyQrpOw==' },
                    'model.json': { "url": "https://model.url", "updatedAt": '2013-04-26T22:22:23.832Z', 'md5': 'mZFLkyvTelC5g8XnyQrpOw==' }
                }
        """
        query = '\n        query RunDownloadUrls($name: String!, $entity: String, $run: String!)  {\n            model(name: $name, entityName: $entity) {\n                bucket(name: $run) {\n                    files {\n                        edges {\n                            node {\n                                name\n                                url\n                                md5\n                                updatedAt\n                            }\n                        }\n                    }\n                }\n            }\n        }\n        '
        run = run or self.current_run_id
        assert run, 'run must be specified'
        entity = entity or self.settings('entity')
        query_result = self.execute(query, variables={'name': project, 'run': run, 'entity': entity})
        if query_result['model'] is None:
            raise CommError(f'Run does not exist {entity}/{project}/{run}.')
        files = self._flatten_edges(query_result['model']['bucket']['files'])
        return {file['name']: file for file in files if file}

    @normalize_exceptions
    def download_url(self, project: str, file_name: str, run: str | None=None, entity: str | None=None) -> dict[str, str] | None:
        """Generate download urls.

        Args:
            project (str): The project to download
            file_name (str): The name of the file to download
            run (str): The run to upload to
            entity (str, optional): The entity to scope this project to.  Defaults to wandb models

        Returns:
            A dict of extensions and urls

                { "url": "https://weights.url", "updatedAt": '2013-04-26T22:22:23.832Z', 'md5': 'mZFLkyvTelC5g8XnyQrpOw==' }

        """
        query = '\n        query RunDownloadUrl($name: String!, $fileName: String!, $entity: String, $run: String!)  {\n            model(name: $name, entityName: $entity) {\n                bucket(name: $run) {\n                    files(names: [$fileName]) {\n                        edges {\n                            node {\n                                name\n                                url\n                                md5\n                                updatedAt\n                            }\n                        }\n                    }\n                }\n            }\n        }\n        '
        run = run or self.current_run_id
        assert run, 'run must be specified'
        query_result = self.execute(query, variables={'name': project, 'run': run, 'fileName': file_name, 'entity': entity or self.settings('entity')})
        if query_result['model']:
            files = self._flatten_edges(query_result['model']['bucket']['files'])
            return files[0] if len(files) > 0 and files[0].get('updatedAt') else None
        else:
            return None

    @normalize_exceptions
    def download_write_file(self, metadata: dict[str, str], out_dir: str | None=None) -> tuple[str, bool]:
        """Download a file from a run and write it to wandb/.

        Args:
            metadata (obj): The metadata object for the file to download. Comes from Api.download_urls().
            out_dir (str, optional): The directory to write the file to. Defaults to wandb/

        Returns:
            A tuple of the file's local path and whether it was downloaded.
        """
        filename = metadata['name']
        path = os.path.join(out_dir or self.settings('wandb_dir'), filename)
        if self.file_current(path, B64MD5(metadata['md5'])):
            return (path, False)
        self.download_file(metadata['url'], path)
        return (path, True)

    def upload_file_azure(self, url: str, file: Any, extra_headers: dict[str, str]) -> None:
        """Upload a file to azure."""
        import requests
        from azure.core.exceptions import AzureError
        client = self._azure_blob_module.BlobClient.from_blob_url(url, retry_policy=self._azure_blob_module.LinearRetry(retry_total=0))
        try:
            if extra_headers.get('Content-MD5') is not None:
                md5: bytes | None = base64.b64decode(extra_headers['Content-MD5'])
            else:
                md5 = None
            content_settings = self._azure_blob_module.ContentSettings(content_md5=md5, content_type=extra_headers.get('Content-Type'))
            client.upload_blob(file, max_concurrency=4, length=len(file), overwrite=True, content_settings=content_settings)
        except AzureError as e:
            if hasattr(e, 'response'):
                response = requests.models.Response()
                response.status_code = e.response.status_code
                response.headers = e.response.headers
                raise requests.exceptions.RequestException(e.message, response=response)
            else:
                raise requests.exceptions.ConnectionError(e.message)

    def upload_multipart_file_chunk(self, url: str, upload_chunk: bytes, extra_headers: dict[str, str] | None=None) -> requests.Response | None:
        """Upload a file chunk to S3 with failure resumption.

        Args:
            url: The url to download
            upload_chunk: The path to the file you want to upload
            extra_headers: A dictionary of extra headers to send with the request

        Returns:
            The `requests` library response object
        """
        import requests
        check_httpclient_logger_handler()
        try:
            if env.is_debug(env=self._environ):
                logger.debug('upload_file: %s', url)
            response = self._upload_file_session.put(url, data=upload_chunk, headers=extra_headers)
            if env.is_debug(env=self._environ):
                logger.debug('upload_file: %s complete', url)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            logger.exception(f'upload_file exception for url={url!r}')
            response_content = e.response.content if e.response is not None else ''
            status_code = e.response.status_code if e.response is not None else 0
            is_aws_retryable = status_code == 400 and 'RequestTimeout' in str(response_content)
            if status_code in (308, 408, 409, 429, 500, 502, 503, 504) or isinstance(e, (requests.exceptions.Timeout, requests.exceptions.ConnectionError)) or is_aws_retryable:
                _e = retry.TransientError(exc=e)
                raise _e.with_traceback(sys.exc_info()[2])
            else:
                get_sentry().reraise(e)
        return response

    def upload_file(self, url: str, file: IO[bytes], callback: ProgressFn | None=None, extra_headers: dict[str, str] | None=None) -> requests.Response | None:
        """Upload a file to W&B with failure resumption.

        Args:
            url: The destination URL.
            file: An open file object for the file to upload.
            callback: A callback passed the number of bytes uploaded since
                the last call, used to report progress. Only honored for
                Azure uploads.
            extra_headers: A dictionary of extra headers to send with the request.

        Returns:
            The `requests` response for Azure uploads, otherwise None.
        """
        extra_headers = extra_headers.copy() if extra_headers else {}
        if 'x-ms-blob-type' not in extra_headers:
            self._service_api.send_api_request(ApiRequest(upload_file_request=UploadFileRequest(url=url, path=str(Path(file.name).resolve()), headers=extra_headers)))
            return None
        import requests
        check_httpclient_logger_handler()
        response: requests.Response | None = None
        progress = Progress(file, callback=callback)
        try:
            if self._azure_blob_module:
                self.upload_file_azure(url, progress, extra_headers)
            else:
                lumina.termwarn('Azure uploads over 256MB require the azure SDK, install with pip install wandb[azure]', repeat=False)
                if env.is_debug(env=self._environ):
                    logger.debug('upload_file: %s', url)
                response = self._upload_file_session.put(url, data=progress, headers=extra_headers)
                if env.is_debug(env=self._environ):
                    logger.debug('upload_file: %s complete', url)
                response.raise_for_status()
        except requests.exceptions.RequestException as e:
            logger.exception(f'upload_file exception for url={url!r}')
            response_content = e.response.content if e.response is not None else ''
            status_code = e.response.status_code if e.response is not None else 0
            is_aws_retryable = 'x-amz-meta-md5' in extra_headers and status_code == 400 and ('RequestTimeout' in str(response_content))
            progress.rewind()
            if status_code in (308, 408, 409, 429, 500, 502, 503, 504) or isinstance(e, (requests.exceptions.Timeout, requests.exceptions.ConnectionError)) or is_aws_retryable:
                _e = retry.TransientError(exc=e)
                raise _e.with_traceback(sys.exc_info()[2])
            else:
                get_sentry().reraise(e)
        return response

    @normalize_exceptions
    def register_agent(self, host: str, sweep_id: str | None=None, project_name: str | None=None, entity: str | None=None) -> dict:
        """Register a new agent.

        Args:
            host (str): hostname
            sweep_id (str): sweep id
            project_name: (str): model that contains sweep
            entity: (str): entity that contains sweep
        """
        mutation = '\n        mutation CreateAgent(\n            $host: String!\n            $projectName: String,\n            $entityName: String,\n            $sweep: String!\n        ) {\n            createAgent(input: {\n                host: $host,\n                projectName: $projectName,\n                entityName: $entityName,\n                sweep: $sweep,\n            }) {\n                agent {\n                    id\n                }\n            }\n        }\n        '
        if entity is None:
            entity = self.settings('entity')
        if project_name is None:
            project_name = self.settings('project')
        response = self.execute(mutation, variables={'host': host, 'entityName': entity, 'projectName': project_name, 'sweep': sweep_id})
        result: dict = response['createAgent']['agent']
        return result

    def agent_heartbeat(self, agent_id: str, metrics: dict, run_states: dict) -> list[dict[str, Any]]:
        """Notify server about agent state, receive commands.

        Args:
            agent_id (str): agent_id
            metrics (dict): system metrics
            run_states (dict): run_id: state mapping

        Returns:
            list of commands to execute.

        Raises:
            SweepNotFoundError: If the server returns a 404, indicating the
                sweep was likely deleted.
        """
        from lumina.sdk.launch.sweeps import SweepNotFoundError
        mutation = '\n        mutation Heartbeat(\n            $id: ID!,\n            $metrics: JSONString,\n            $runState: JSONString\n        ) {\n            agentHeartbeat(input: {\n                id: $id,\n                metrics: $metrics,\n                runState: $runState\n            }) {\n                agent {\n                    id\n                }\n                commands\n            }\n        }\n        '
        if agent_id is None:
            raise ValueError('Cannot call heartbeat with an unregistered agent.')
        try:
            response = self.execute(mutation, variables={'id': agent_id, 'metrics': json.dumps(metrics), 'runState': json.dumps(run_states)}, timeout=60)
        except WandbApiFailedError as e:
            if e.response is not None and e.response.http_status == 404:
                raise SweepNotFoundError('Sweep not found. The sweep may have been deleted.') from e
            logger.exception('Error communicating with W&B.')
            return []
        except Exception:
            logger.exception('Error communicating with W&B.')
            return []
        else:
            result: list[dict[str, Any]] = json.loads(response['agentHeartbeat']['commands'])
            return result

    @staticmethod
    def _validate_config_and_fill_distribution(config: dict) -> dict:
        config = deepcopy(config)
        config = dict(config)
        if 'parameters' not in config:
            return config
        for parameter_name in config['parameters']:
            parameter = config['parameters'][parameter_name]
            if 'min' in parameter and 'max' in parameter and ('distribution' not in parameter):
                if isinstance(parameter['min'], int) and isinstance(parameter['max'], int):
                    parameter['distribution'] = 'int_uniform'
                elif isinstance(parameter['min'], float) and isinstance(parameter['max'], float):
                    parameter['distribution'] = 'uniform'
                else:
                    raise ValueError(f'Parameter {parameter_name} is ambiguous, please specify bounds as both floats (for a float_uniform distribution) or ints (for an int_uniform distribution).')
        return config

    @normalize_exceptions
    def upsert_sweep(self, config: dict, controller: str | None=None, launch_scheduler: str | None=None, scheduler: str | None=None, obj_id: str | None=None, project: str | None=None, entity: str | None=None, state: str | None=None, prior_runs: list[str] | None=None, display_name: str | None=None, template_variable_values: dict[str, Any] | None=None) -> tuple[str, list[str]]:
        """Upsert a sweep object.

        Args:
            config (dict): sweep config (will be converted to yaml)
            controller (str): controller to use
            launch_scheduler (str): launch scheduler to use
            scheduler (str): scheduler to use
            obj_id (str): object id
            project (str): project to use
            entity (str): entity to use
            state (str): state
            prior_runs (list): IDs of existing runs to add to the sweep
            display_name (str): display name for the sweep
            template_variable_values (dict): template variable values
        """
        import yaml
        project_query = '\n            project {\n                id\n                name\n                entity {\n                    id\n                    name\n                }\n            }\n        '
        mutation_str = '\n        mutation UpsertSweep(\n            $id: ID,\n            $config: String,\n            $description: String,\n            $entityName: String,\n            $projectName: String,\n            $controller: JSONString,\n            $scheduler: JSONString,\n            $state: String,\n            $priorRunsFilters: JSONString,\n            $displayName: String,\n        ) {\n            upsertSweep(input: {\n                id: $id,\n                config: $config,\n                description: $description,\n                entityName: $entityName,\n                projectName: $projectName,\n                controller: $controller,\n                scheduler: $scheduler,\n                state: $state,\n                priorRunsFilters: $priorRunsFilters,\n                displayName: $displayName,\n            }) {\n                sweep {\n                    name\n                    _PROJECT_QUERY_\n                }\n                configValidationWarnings\n            }\n        }\n        '
        mutation_5 = mutation_str.replace('$controller: JSONString,', '$controller: JSONString,$launchScheduler: JSONString, $templateVariableValues: JSONString,').replace('controller: $controller,', 'controller: $controller,launchScheduler: $launchScheduler,templateVariableValues: $templateVariableValues,').replace('_PROJECT_QUERY_', project_query)
        mutation_4 = mutation_str.replace('$controller: JSONString,', '$controller: JSONString,$launchScheduler: JSONString,').replace('controller: $controller,', 'controller: $controller,launchScheduler: $launchScheduler').replace('_PROJECT_QUERY_', project_query)
        mutation_3 = mutation_str.replace('_PROJECT_QUERY_', project_query)
        mutation_2 = mutation_str.replace('_PROJECT_QUERY_', project_query).replace('configValidationWarnings', '')
        mutation_1 = mutation_str.replace('_PROJECT_QUERY_', '').replace('configValidationWarnings', '')
        mutations = [mutation_5, mutation_4]
        if launch_scheduler is None:
            mutations.extend([mutation_3, mutation_2, mutation_1])
        config = self._validate_config_and_fill_distribution(config)

        class NonOctalStringDumper(yaml.Dumper):
            """Prevents strings containing non-octal values like "008" and "009" from being converted to numbers in in the yaml string saved as the sweep config."""

            def represent_scalar(self, tag, value, style=None):
                if tag == 'tag:yaml.org,2002:str' and value.startswith('0') and (len(value) > 1):
                    return super().represent_scalar(tag, value, style="'")
                return super().represent_scalar(tag, value, style)
        config_str = yaml.dump(json.loads(json.dumps(config)), Dumper=NonOctalStringDumper)
        filters = None
        if prior_runs:
            filters = json.dumps({'$or': [{'name': r} for r in prior_runs]})
        err: Exception | None = None
        for mutation in mutations:
            try:
                variables = {'id': obj_id, 'config': config_str, 'description': config.get('description'), 'entityName': entity or self.settings('entity'), 'projectName': project or self.settings('project'), 'controller': controller, 'launchScheduler': launch_scheduler, 'templateVariableValues': json.dumps(template_variable_values), 'scheduler': scheduler, 'priorRunsFilters': filters, 'displayName': display_name}
                if state:
                    variables['state'] = state
                response = self.execute(mutation, variables=variables)
            except UsageError:
                raise
            except Exception as e:
                err = e
                continue
            err = None
            break
        if err:
            raise err
        sweep: dict[str, dict[str, dict]] = response['upsertSweep']['sweep']
        project_obj: dict[str, dict] = sweep.get('project', {})
        if project_obj:
            self.set_setting('project', project_obj['name'])
            entity_obj: dict = project_obj.get('entity', {})
            if entity_obj:
                self.set_setting('entity', entity_obj['name'])
        warnings = response['upsertSweep'].get('configValidationWarnings', [])
        return (response['upsertSweep']['sweep']['name'], warnings)

    @staticmethod
    def file_current(fname: str, md5: B64MD5) -> bool:
        """Checksum a file and compare the md5 with the known md5."""
        return os.path.isfile(fname) and md5_file_b64(fname) == md5

    def get_project(self) -> str:
        project: str = self.default_settings.get('project') or self.settings('project')
        return project

    @normalize_exceptions
    def push(self, files: list[str] | dict[str, IO], run: str | None=None, entity: str | None=None, project: str | None=None, description: str | None=None, force: bool=True, progress: TextIO | Literal[False]=False) -> list[requests.Response | None]:
        """Uploads multiple files to W&B.

        Args:
            files (list or dict): The filenames to upload, when dict the values are open files
            run (str, optional): The run to upload to
            entity (str, optional): The entity to scope this project to.  Defaults to wandb models
            project (str, optional): The name of the project to upload to. Defaults to the one in settings.
            description (str, optional): The description of the changes
            force (bool, optional): Whether to prevent push if git has uncommitted changes
            progress (callable, or stream): If callable, will be called with (chunk_bytes,
                total_bytes) as argument. If TextIO, renders a progress bar to it.

        Returns:
            A list of `requests.Response` objects
        """
        if project is None:
            project = self.get_project()
        if project is None:
            raise CommError('No project configured.')
        if run is None:
            run = self.current_run_id
        _, upload_headers, result = self.upload_urls(project, files, run, entity)
        extra_headers = {}
        for upload_header in upload_headers:
            key, val = upload_header.split(':', 1)
            extra_headers[key] = val
        responses = []
        for file_name, file_info in result.items():
            file_url = file_info['uploadUrl']
            if file_url.startswith('/'):
                file_url = f'{self.api_url}{file_url}'
            try:
                normal_name = os.path.join(*file_name.split('/'))
                open_file = files[file_name] if isinstance(files, dict) else open(normal_name, 'rb')
            except OSError:
                print(f'{file_name} does not exist')
                continue
            if progress is False:
                responses.append(self.upload_file_retry(file_info['uploadUrl'], open_file, extra_headers=extra_headers))
            elif callable(progress):
                responses.append(self.upload_file_retry(file_url, open_file, progress, extra_headers=extra_headers))
            else:
                length = os.fstat(open_file.fileno()).st_size
                with click.progressbar(file=progress, length=length, label=f'Uploading file: {file_name}', fill_char=click.style('&', fg='green')) as bar:
                    responses.append(self.upload_file_retry(file_url, open_file, lambda bites, _: bar.update(bites), extra_headers=extra_headers))
            open_file.close()
        return responses

    def link_artifact(self, client_id: str, server_id: str, portfolio_name: str, entity: str, project: str, aliases: Sequence[str], organization: str) -> dict[str, Any]:
        from lumina.sdk.artifacts._validators import is_artifact_registry_project
        template = '\n                mutation LinkArtifact(\n                    $artifactPortfolioName: String!,\n                    $entityName: String!,\n                    $projectName: String!,\n                    $aliases: [ArtifactAliasInput!],\n                    ID_TYPE\n                    ) {\n                        linkArtifact(input: {\n                            artifactPortfolioName: $artifactPortfolioName,\n                            entityName: $entityName,\n                            projectName: $projectName,\n                            aliases: $aliases,\n                            ID_VALUE\n                        }) {\n                            versionIndex\n                        }\n                    }\n            '
        org_entity = ''
        if is_artifact_registry_project(project):
            try:
                org_entity = self._resolve_org_entity_name(entity=entity, organization=organization)
            except ValueError as e:
                lumina.termerror(str(e))
                raise

        def replace(a: str, b: str) -> None:
            nonlocal template
            template = template.replace(a, b)
        if server_id:
            replace('ID_TYPE', '$artifactID: ID')
            replace('ID_VALUE', 'artifactID: $artifactID')
        elif client_id:
            replace('ID_TYPE', '$clientID: ID')
            replace('ID_VALUE', 'clientID: $clientID')
        variables = {'clientID': client_id, 'artifactID': server_id, 'artifactPortfolioName': portfolio_name, 'entityName': org_entity or entity, 'projectName': project, 'aliases': [{'alias': alias, 'artifactCollectionName': portfolio_name} for alias in aliases]}
        mutation = template
        response = self.execute(mutation, variables=variables)
        link_artifact: dict[str, Any] = response['linkArtifact']
        return link_artifact

    def _resolve_org_entity_name(self, entity: str, organization: str='') -> str:
        if not entity:
            raise ValueError('Entity name is required to resolve org entity name.')
        orgs_from_entity = self._fetch_orgs_and_org_entities_from_entity(entity)
        if organization:
            return _match_org_with_fetched_org_entities(organization, orgs_from_entity)
        if len(orgs_from_entity) > 1:
            raise ValueError(f'Personal entity {entity!r} belongs to multiple organizations and cannot be used without specifying the organization name. Please specify the organization in the Registry path or use a team entity in the entity settings.')
        return orgs_from_entity[0].entity_name

    def _fetch_orgs_and_org_entities_from_entity(self, entity: str) -> list[_OrgNames]:
        """Fetches organization entity names and display names for a given entity.

        Args:
            entity (str): Entity name to lookup. Can be either a personal or team entity.

        Returns:
            list[_OrgNames]: list of _OrgNames tuples. (_OrgNames(entity_name, display_name))

        Raises:
        ValueError: If entity is not found, has no organizations, or other validation errors.
        """
        query = '\n            query FetchOrgEntityFromEntity($entityName: String!) {\n                entity(name: $entityName) {\n                    organization {\n                        name\n                        orgEntity {\n                            name\n                        }\n                    }\n                    user {\n                        organizations {\n                            name\n                            orgEntity {\n                                name\n                            }\n                        }\n                    }\n                }\n            }\n            '
        response = self.execute(query, variables={'entityName': entity})
        entity_resp = response['entity']['organization']
        user_resp = response['entity']['user']
        if entity_resp:
            org_name = entity_resp.get('name')
            org_entity_name = entity_resp.get('orgEntity') and entity_resp['orgEntity'].get('name')
            if not org_name or not org_entity_name:
                raise ValueError(f'Unable to find an organization under entity {entity!r}.')
            return [_OrgNames(entity_name=org_entity_name, display_name=org_name)]
        elif user_resp:
            orgs = user_resp.get('organizations', [])
            org_entities_return = [_OrgNames(entity_name=org['orgEntity']['name'], display_name=org['name']) for org in orgs if org.get('orgEntity') and org.get('name')]
            if not org_entities_return:
                raise ValueError(f"Unable to resolve an organization associated with personal entity: {entity!r}. This could be because its a personal entity that doesn't belong to any organizations. Please specify the organization in the Registry path or use a team entity in the entity settings.")
            return org_entities_return
        else:
            raise ValueError(f'Unable to find an organization under entity {entity!r}.')

    def _construct_use_artifact_query(self, artifact_id: str, entity_name: str | None=None, project_name: str | None=None, run_name: str | None=None, use_as: str | None=None, artifact_entity_name: str | None=None, artifact_project_name: str | None=None) -> tuple[str, dict[str, Any]]:
        query_vars = ['$entityName: String!', '$projectName: String!', '$runName: String!', '$artifactID: ID!']
        query_args = ['entityName: $entityName', 'projectName: $projectName', 'runName: $runName', 'artifactID: $artifactID']
        if use_as:
            query_vars.append('$usedAs: String')
            query_args.append('usedAs: $usedAs')
        entity_name = entity_name or self.settings('entity')
        project_name = project_name or self.settings('project')
        run_name = run_name or self.current_run_id
        variables: dict[str, Any] = {'entityName': entity_name, 'projectName': project_name, 'runName': run_name, 'artifactID': artifact_id, 'usedAs': use_as}
        server_allows_entity_project_information = self._server_supports(ServerFeature.USE_ARTIFACT_WITH_ENTITY_AND_PROJECT_INFORMATION)
        if server_allows_entity_project_information:
            query_vars.extend(['$artifactEntityName: String', '$artifactProjectName: String'])
            query_args.extend(['artifactEntityName: $artifactEntityName', 'artifactProjectName: $artifactProjectName'])
            variables['artifactEntityName'] = artifact_entity_name
            variables['artifactProjectName'] = artifact_project_name
        vars_str = ', '.join(query_vars)
        args_str = ', '.join(query_args)
        query = f'\n            mutation UseArtifact({vars_str}) {{\n                useArtifact(input: {{{args_str}}}) {{\n                    artifact {{\n                        id\n                        digest\n                        description\n                        state\n                        createdAt\n                        metadata\n                    }}\n                }}\n            }}\n            '
        return (query, variables)

    def use_artifact(self, artifact_id: str, entity_name: str | None=None, project_name: str | None=None, run_name: str | None=None, artifact_entity_name: str | None=None, artifact_project_name: str | None=None, use_as: str | None=None) -> dict[str, Any] | None:
        query, variables = self._construct_use_artifact_query(artifact_id, entity_name, project_name, run_name, use_as, artifact_entity_name, artifact_project_name)
        response = self.execute(query, variables)
        if response['useArtifact']['artifact']:
            artifact: dict[str, Any] = response['useArtifact']['artifact']
            return artifact
        return None

    def create_artifact_type(self, artifact_type_name: str, entity_name: str | None=None, project_name: str | None=None, description: str | None=None) -> str | None:
        mutation = '\n        mutation CreateArtifactType(\n            $entityName: String!,\n            $projectName: String!,\n            $artifactTypeName: String!,\n            $description: String\n        ) {\n            createArtifactType(input: {\n                entityName: $entityName,\n                projectName: $projectName,\n                name: $artifactTypeName,\n                description: $description\n            }) {\n                artifactType {\n                    id\n                }\n            }\n        }\n        '
        entity_name = entity_name or self.settings('entity')
        project_name = project_name or self.settings('project')
        response = self.execute(mutation, variables={'entityName': entity_name, 'projectName': project_name, 'artifactTypeName': artifact_type_name, 'description': description})
        _id: str | None = response['createArtifactType']['artifactType']['id']
        return _id

    def _get_create_artifact_mutation(self, history_step: int | None, distributed_id: str | None) -> str:
        types = ''
        values = ''
        if history_step not in [0, None]:
            types += '$historyStep: Int64!,'
            values += 'historyStep: $historyStep,'
        if distributed_id:
            types += '$distributedID: String,'
            values += 'distributedID: $distributedID,'
        query_template = '\n            mutation CreateArtifact(\n                $artifactTypeName: String!,\n                $artifactCollectionNames: [String!],\n                $entityName: String!,\n                $projectName: String!,\n                $runName: String,\n                $description: String,\n                $digest: String!,\n                $aliases: [ArtifactAliasInput!],\n                $metadata: JSONString,\n                $clientID: ID,\n                $sequenceClientID: ID,\n                $ttlDurationSeconds: Int64,\n                $tags: [TagInput!],\n                _CREATE_ARTIFACT_ADDITIONAL_TYPE_\n            ) {\n                createArtifact(input: {\n                    artifactTypeName: $artifactTypeName,\n                    artifactCollectionNames: $artifactCollectionNames,\n                    entityName: $entityName,\n                    projectName: $projectName,\n                    runName: $runName,\n                    description: $description,\n                    digest: $digest,\n                    digestAlgorithm: MANIFEST_MD5,\n                    aliases: $aliases,\n                    metadata: $metadata,\n                    clientID: $clientID,\n                    sequenceClientID: $sequenceClientID,\n                    enableDigestDeduplication: true,\n                    ttlDurationSeconds: $ttlDurationSeconds,\n                    tags: $tags,\n                    _CREATE_ARTIFACT_ADDITIONAL_VALUE_\n                }) {\n                    artifact {\n                        id\n                        state\n                        artifactSequence {\n                            id\n                            latestArtifact {\n                                id\n                                versionIndex\n                            }\n                        }\n                    }\n                }\n            }\n        '
        return query_template.replace('_CREATE_ARTIFACT_ADDITIONAL_TYPE_', types).replace('_CREATE_ARTIFACT_ADDITIONAL_VALUE_', values)

    def create_artifact(self, artifact_type_name: str, artifact_collection_name: str, digest: str, client_id: str | None=None, sequence_client_id: str | None=None, entity_name: str | None=None, project_name: str | None=None, run_name: str | None=None, description: str | None=None, metadata: dict | None=None, ttl_duration_seconds: int | None=None, aliases: list[dict[str, str]] | None=None, tags: list[dict[str, str]] | None=None, distributed_id: str | None=None, is_user_created: bool | None=False, history_step: int | None=None) -> tuple[dict, dict]:
        query_template = self._get_create_artifact_mutation(history_step, distributed_id)
        entity_name = entity_name or self.settings('entity')
        project_name = project_name or self.settings('project')
        if not is_user_created:
            run_name = run_name or self.current_run_id
        mutation = query_template
        response = self.execute(mutation, variables={'entityName': entity_name, 'projectName': project_name, 'runName': run_name, 'artifactTypeName': artifact_type_name, 'artifactCollectionNames': [artifact_collection_name], 'clientID': client_id, 'sequenceClientID': sequence_client_id, 'digest': digest, 'description': description, 'aliases': list(aliases or []), 'tags': list(tags or []), 'metadata': json.dumps(util.make_safe_for_json(metadata)) if metadata else None, 'ttlDurationSeconds': ttl_duration_seconds, 'distributedID': distributed_id, 'historyStep': history_step})
        av = response['createArtifact']['artifact']
        latest = response['createArtifact']['artifact']['artifactSequence'].get('latestArtifact')
        return (av, latest)

    def commit_artifact(self, artifact_id: str) -> _Response:
        mutation = '\n        mutation CommitArtifact(\n            $artifactID: ID!,\n        ) {\n            commitArtifact(input: {\n                artifactID: $artifactID,\n            }) {\n                artifact {\n                    id\n                    digest\n                }\n            }\n        }\n        '
        response: _Response = self.execute(mutation, variables={'artifactID': artifact_id}, timeout=60)
        return response

    def complete_multipart_upload_artifact(self, artifact_id: str, storage_path: str, completed_parts: list[dict[str, Any]], upload_id: str | None, complete_multipart_action: str='Complete') -> str | None:
        mutation = '\n        mutation CompleteMultipartUploadArtifact(\n            $completeMultipartAction: CompleteMultipartAction!,\n            $completedParts: [UploadPartsInput!]!,\n            $artifactID: ID!\n            $storagePath: String!\n            $uploadID: String!\n        ) {\n        completeMultipartUploadArtifact(\n            input: {\n                completeMultipartAction: $completeMultipartAction,\n                completedParts: $completedParts,\n                artifactID: $artifactID,\n                storagePath: $storagePath\n                uploadID: $uploadID\n            }\n            ) {\n                digest\n            }\n        }\n        '
        response = self.execute(mutation, variables={'completeMultipartAction': complete_multipart_action, 'artifactID': artifact_id, 'storagePath': storage_path, 'completedParts': completed_parts, 'uploadID': upload_id})
        digest: str | None = response['completeMultipartUploadArtifact']['digest']
        return digest

    def create_artifact_manifest(self, name: str, digest: str, artifact_id: str | None, base_artifact_id: str | None=None, entity: str | None=None, project: str | None=None, run: str | None=None, include_upload: bool=True, type: str='FULL') -> tuple[str, dict[str, Any]]:
        mutation = '\n        mutation CreateArtifactManifest(\n            $name: String!,\n            $digest: String!,\n            $artifactID: ID!,\n            $baseArtifactID: ID,\n            $entityName: String!,\n            $projectName: String!,\n            $runName: String!,\n            $includeUpload: Boolean!,\n            {}\n        ) {{\n            createArtifactManifest(input: {{\n                name: $name,\n                digest: $digest,\n                artifactID: $artifactID,\n                baseArtifactID: $baseArtifactID,\n                entityName: $entityName,\n                projectName: $projectName,\n                runName: $runName,\n                {}\n            }}) {{\n                artifactManifest {{\n                    id\n                    file {{\n                        id\n                        name\n                        displayName\n                        uploadUrl @include(if: $includeUpload)\n                        uploadHeaders @include(if: $includeUpload)\n                    }}\n                }}\n            }}\n        }}\n        '.format('$type: ArtifactManifestType = FULL' if type != 'FULL' else '', 'type: $type' if type != 'FULL' else '')
        entity_name = entity or self.settings('entity')
        project_name = project or self.settings('project')
        run_name = run or self.current_run_id
        response = self.execute(mutation, variables={'name': name, 'digest': digest, 'artifactID': artifact_id, 'baseArtifactID': base_artifact_id, 'entityName': entity_name, 'projectName': project_name, 'runName': run_name, 'includeUpload': include_upload, 'type': type})
        return (response['createArtifactManifest']['artifactManifest']['id'], response['createArtifactManifest']['artifactManifest']['file'])

    def update_artifact_manifest(self, artifact_manifest_id: str, base_artifact_id: str | None=None, digest: str | None=None, include_upload: bool | None=True) -> tuple[str, dict[str, Any]]:
        mutation = '\n        mutation UpdateArtifactManifest(\n            $artifactManifestID: ID!,\n            $digest: String,\n            $baseArtifactID: ID,\n            $includeUpload: Boolean!,\n        ) {\n            updateArtifactManifest(input: {\n                artifactManifestID: $artifactManifestID,\n                digest: $digest,\n                baseArtifactID: $baseArtifactID,\n            }) {\n                artifactManifest {\n                    id\n                    file {\n                        id\n                        name\n                        displayName\n                        uploadUrl @include(if: $includeUpload)\n                        uploadHeaders @include(if: $includeUpload)\n                    }\n                }\n            }\n        }\n        '
        response = self.execute(mutation, variables={'artifactManifestID': artifact_manifest_id, 'digest': digest, 'baseArtifactID': base_artifact_id, 'includeUpload': include_upload})
        return (response['updateArtifactManifest']['artifactManifest']['id'], response['updateArtifactManifest']['artifactManifest']['file'])

    def update_artifact_metadata(self, artifact_id: str, metadata: dict[str, Any]) -> dict[str, Any]:
        """Set the metadata of the given artifact version."""
        mutation = '\n        mutation UpdateArtifact(\n            $artifactID: ID!,\n            $metadata: JSONString,\n        ) {\n            updateArtifact(input: {\n                artifactID: $artifactID,\n                metadata: $metadata,\n            }) {\n                artifact {\n                    id\n                }\n            }\n        }\n        '
        response = self.execute(mutation, variables={'artifactID': artifact_id, 'metadata': json.dumps(metadata)})
        return response['updateArtifact']['artifact']

    def _resolve_client_id(self, client_id: str) -> str | None:
        if client_id in self._client_id_mapping:
            return self._client_id_mapping[client_id]
        query = '\n            query ClientIDMapping($clientID: ID!) {\n                clientIDMapping(clientID: $clientID) {\n                    serverID\n                }\n            }\n        '
        response = self.execute(query, variables={'clientID': client_id})
        server_id = None
        if response is not None:
            client_id_mapping = response.get('clientIDMapping')
            if client_id_mapping is not None:
                server_id = client_id_mapping.get('serverID')
                if server_id is not None:
                    self._client_id_mapping[client_id] = server_id
        return server_id

    @normalize_exceptions
    def create_artifact_files(self, artifact_files: Iterable[CreateArtifactFileSpecInput]) -> Mapping[str, CreateArtifactFilesResponseFile]:
        query_template = '\n        mutation CreateArtifactFiles(\n            $storageLayout: ArtifactStorageLayout!\n            $artifactFiles: [CreateArtifactFileSpecInput!]!\n        ) {\n            createArtifactFiles(input: {\n                artifactFiles: $artifactFiles,\n                storageLayout: $storageLayout,\n            }) {\n                files {\n                    edges {\n                        node {\n                            id\n                            name\n                            displayName\n                            uploadUrl\n                            uploadHeaders\n                            storagePath\n                            uploadMultipartUrls {\n                                uploadID\n                                uploadUrlParts {\n                                    partNumber\n                                    uploadUrl\n                                }\n                            }\n                            artifact {\n                                id\n                            }\n                        }\n                    }\n                }\n            }\n        }\n        '
        storage_layout = 'V2'
        if env.get_use_v1_artifacts():
            storage_layout = 'V1'
        mutation = query_template
        response = self.execute(mutation, variables={'storageLayout': storage_layout, 'artifactFiles': [af for af in artifact_files]})
        result = {}
        for edge in response['createArtifactFiles']['files']['edges']:
            node = edge['node']
            result[node['displayName']] = node
        return result

    @normalize_exceptions
    def notify_scriptable_run_alert(self, title: str, text: str, level: str | None=None, wait_duration: Number | None=None) -> bool:
        mutation = '\n        mutation NotifyScriptableRunAlert(\n            $entityName: String!,\n            $projectName: String!,\n            $runName: String!,\n            $title: String!,\n            $text: String!,\n            $severity: AlertSeverity = INFO,\n            $waitDuration: Duration\n        ) {\n            notifyScriptableRunAlert(input: {\n                entityName: $entityName,\n                projectName: $projectName,\n                runName: $runName,\n                title: $title,\n                text: $text,\n                severity: $severity,\n                waitDuration: $waitDuration\n            }) {\n               success\n            }\n        }\n        '
        response = self.execute(mutation, variables={'entityName': self.settings('entity'), 'projectName': self.settings('project'), 'runName': self.current_run_id, 'title': title, 'text': text, 'severity': level, 'waitDuration': wait_duration})
        success: bool = response['notifyScriptableRunAlert']['success']
        return success

    def get_sweep_state(self, sweep: str, entity: str | None=None, project: str | None=None) -> SweepState:
        query = '\n            query GetSweepState($entity: String, $project: String, $sweep: String!) {\n                project(name: $project, entityName: $entity) {\n                    sweep(sweepName: $sweep) {\n                        state\n                    }\n                }\n            }\n            '
        response = self.execute(query, variables={'sweep': sweep, 'entity': entity or self.settings('entity'), 'project': project or self.settings('project')})
        return response['project']['sweep']['state']

    def set_sweep_state(self, sweep: str, state: SweepState, entity: str | None=None, project: str | None=None) -> None:
        assert state in ('RUNNING', 'PAUSED', 'CANCELED', 'FINISHED')
        s = self.sweep(sweep=sweep, entity=entity, project=project, specs='{}')
        curr_state = s['state'].upper()
        if state == 'PAUSED' and curr_state not in ('PAUSED', 'RUNNING'):
            raise Exception(f'Cannot pause {curr_state.lower()} sweep.')
        elif state != 'RUNNING' and curr_state not in ('RUNNING', 'PAUSED', 'PENDING'):
            raise Exception(f'Sweep already {curr_state.lower()}.')
        sweep_id = s['id']
        mutation = '\n        mutation UpsertSweep(\n            $id: ID,\n            $state: String,\n            $entityName: String,\n            $projectName: String\n        ) {\n            upsertSweep(input: {\n                id: $id,\n                state: $state,\n                entityName: $entityName,\n                projectName: $projectName\n            }){\n                sweep {\n                    name\n                }\n            }\n        }\n        '
        self.execute(mutation, variables={'id': sweep_id, 'state': state, 'entityName': entity or self.settings('entity'), 'projectName': project or self.settings('project')})

    def stop_sweep(self, sweep: str, entity: str | None=None, project: str | None=None) -> None:
        """Finish the sweep to stop running new runs and let currently running runs finish."""
        self.set_sweep_state(sweep=sweep, state='FINISHED', entity=entity, project=project)

    def cancel_sweep(self, sweep: str, entity: str | None=None, project: str | None=None) -> None:
        """Cancel the sweep to kill all running runs and stop running new runs."""
        self.set_sweep_state(sweep=sweep, state='CANCELED', entity=entity, project=project)

    def pause_sweep(self, sweep: str, entity: str | None=None, project: str | None=None) -> None:
        """Pause the sweep to temporarily stop running new runs."""
        self.set_sweep_state(sweep=sweep, state='PAUSED', entity=entity, project=project)

    def resume_sweep(self, sweep: str, entity: str | None=None, project: str | None=None) -> None:
        """Resume the sweep to continue running new runs."""
        self.set_sweep_state(sweep=sweep, state='RUNNING', entity=entity, project=project)

    def _status_request(self, url: str, length: int) -> requests.Response:
        """Ask google how much we've uploaded."""
        import requests
        check_httpclient_logger_handler()
        return requests.put(url=url, headers={'Content-Length': '0', 'Content-Range': f'bytes */{length}'})

    def _flatten_edges(self, response: _Response) -> list[dict]:
        """Return an array from the nested graphql relay structure."""
        return [node['node'] for node in response['edges']]

    @normalize_exceptions
    def stop_run(self, run_id: str) -> bool:
        mutation = '\n            mutation stopRun($id: ID!) {\n                stopRun(input: {\n                    id: $id\n                }) {\n                    clientMutationId\n                    success\n                }\n            }\n            '
        response = self.execute(mutation, variables={'id': run_id})
        success: bool = response['stopRun'].get('success')
        return success

    @normalize_exceptions
    def create_custom_chart(self, entity: str, name: str, display_name: str, spec_type: str, access: str, spec: str | Mapping[str, Any]) -> dict[str, Any] | None:
        if not isinstance(spec, str):
            spec = json.dumps(spec)
        mutation = '\n            mutation CreateCustomChart(\n                $entity: String!\n                $name: String!\n                $displayName: String!\n                $type: String!\n                $access: String!\n                $spec: JSONString!\n            ) {\n                createCustomChart(\n                    input: {\n                        entity: $entity\n                        name: $name\n                        displayName: $displayName\n                        type: $type\n                        access: $access\n                        spec: $spec\n                    }\n                ) {\n                    chart { id }\n                }\n            }\n            '
        variables = {'entity': entity, 'name': name, 'displayName': display_name, 'type': spec_type, 'access': access, 'spec': spec}
        result: dict[str, Any] | None = self.execute(mutation, variables)['createCustomChart']
        return result
