"""job builder."""
from __future__ import annotations
import json
import logging
import os
import re
import sys
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, Literal, TypedDict
import lumina
from lumina.sdk.artifacts._internal_artifact import InternalArtifact
from lumina.sdk.artifacts.artifact import Artifact
from lumina.sdk.data_types._dtypes import TypeRegistry
from lumina.sdk.internal.internal_api import Api
from lumina.sdk.lib.filenames import DIFF_FNAME, METADATA_FNAME, REQUIREMENTS_FNAME
from lumina.util import make_artifact_name_safe
from .settings_static import SettingsStatic
_logger = logging.getLogger(__name__)
if TYPE_CHECKING:
    from lumina.proto.wandb_internal_pb2 import ArtifactRecord
FROZEN_REQUIREMENTS_FNAME = 'requirements.frozen.txt'
JOB_FNAME = 'wandb-job.json'
JOB_ARTIFACT_TYPE = 'job'
LOG_LEVEL = Literal['log', 'warn', 'error']

class Version:

    def __init__(self, major: int, minor: int, patch: int):
        self._major = major
        self._minor = minor
        self._patch = patch

    def __repr__(self) -> str:
        return f'{self._major}.{self._minor}.{self._patch}'

    def __lt__(self, other: Version) -> bool:
        if self._major < other._major:
            return True
        elif self._major == other._major:
            if self._minor < other._minor:
                return True
            elif self._minor == other._minor and self._patch < other._patch:
                return True
        return False

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Version):
            return NotImplemented
        return self._major == other._major and self._minor == other._minor and (self._patch == other._patch)
SOURCE_KEYS_MIN_SUPPORTED_VERSION = {'dockerfile': Version(0, 17, 0), 'build_context': Version(0, 17, 0)}

class GitInfo(TypedDict):
    remote: str
    commit: str

class GitSourceDict(TypedDict):
    git: GitInfo
    entrypoint: list[str]
    notebook: bool
    build_context: str | None
    dockerfile: str | None

class ArtifactSourceDict(TypedDict):
    artifact: str
    entrypoint: list[str]
    notebook: bool
    build_context: str | None
    dockerfile: str | None

class ImageSourceDict(TypedDict):
    image: str

class JobSourceDict(TypedDict, total=False):
    _version: str
    source_type: str
    source: GitSourceDict | ArtifactSourceDict | ImageSourceDict
    input_types: dict[str, Any]
    output_types: dict[str, Any]
    runtime: str | None
    services: dict[str, str]

class ArtifactInfoForJob(TypedDict):
    id: str
    name: str

def get_min_supported_for_source_dict(source: GitSourceDict | ArtifactSourceDict | ImageSourceDict) -> Version | None:
    """Get the minimum supported wandb version the source dict of wandb-job.json."""
    min_seen = None
    for key in source:
        new_ver = SOURCE_KEYS_MIN_SUPPORTED_VERSION.get(key)
        if new_ver and (min_seen is None or new_ver < min_seen):
            min_seen = new_ver
    return min_seen

class JobBuilder:
    _settings: SettingsStatic
    _files_dir: str
    _metadatafile_path: str | None
    _requirements_path: str | None
    _config: dict[str, Any] | None
    _summary: dict[str, Any] | None
    _logged_code_artifact: ArtifactInfoForJob | None
    _disable: bool
    _partial_source_id: str | None
    _aliases: list[str]
    _job_seq_id: str | None
    _job_version_alias: str | None
    _is_notebook_run: bool
    _verbose: bool
    _services: dict[str, str]

    def __init__(self, settings: SettingsStatic, verbose: bool=False, *, files_dir: str):
        """Instantiate a JobBuilder.

        Args:
            settings: Parameters for the job builder.
                In a run, this is the run's settings.
                Otherwise, this is a set of undocumented parameters,
                all of which should be made explicit like files_dir.
            files_dir: The directory where to write files.
                In a run, this should be the run's files directory.
        """
        self._settings = settings
        self._files_dir = files_dir
        self._metadatafile_path = None
        self._requirements_path = None
        self._config = None
        self._summary = None
        self._logged_code_artifact = None
        self._job_seq_id = None
        self._job_version_alias = None
        self._disable = settings.disable_job_creation or settings.x_disable_machine_info
        self._partial_source_id = None
        self._aliases = []
        self._source_type: Literal['repo', 'artifact', 'image'] | None = settings.job_source
        self._is_notebook_run = self._get_is_notebook_run()
        self._verbose = verbose
        self._partial = False
        self._services = {}

    def set_config(self, config: dict[str, Any]) -> None:
        self._config = config

    def set_summary(self, summary: dict[str, Any]) -> None:
        self._summary = summary

    @property
    def disable(self) -> bool:
        return self._disable

    @disable.setter
    def disable(self, val: bool) -> None:
        self._disable = val

    @property
    def input_types(self) -> dict[str, Any]:
        return TypeRegistry.type_of(self._config).to_json()

    @property
    def output_types(self) -> dict[str, Any]:
        return TypeRegistry.type_of(self._summary).to_json()

    def set_partial_source_id(self, source_id: str) -> None:
        self._partial_source_id = source_id

    def _handle_server_artifact(self, res: dict | None, artifact: ArtifactRecord) -> None:
        if artifact.type == 'job' and res is not None:
            try:
                if res['artifactSequence']['latestArtifact'] is None:
                    self._job_version_alias = 'v0'
                elif res['artifactSequence']['latestArtifact']['id'] == res['id']:
                    self._job_version_alias = f"v{res['artifactSequence']['latestArtifact']['versionIndex']}"
                else:
                    self._job_version_alias = f"v{res['artifactSequence']['latestArtifact']['versionIndex'] + 1}"
                self._job_seq_id = res['artifactSequence']['id']
            except KeyError as e:
                _logger.info(f'Malformed response from ArtifactSaver.save {e}')
        if artifact.type == 'code' and res is not None:
            self._logged_code_artifact = ArtifactInfoForJob({'id': res['id'], 'name': artifact.name})

    def _build_repo_job_source(self, program_relpath: str, metadata: dict[str, Any]) -> tuple[GitSourceDict | None, str | None]:
        git_info: dict[str, str] = metadata.get('git', {})
        remote = git_info.get('remote')
        commit = git_info.get('commit')
        root = metadata.get('root')
        assert remote is not None
        assert commit is not None
        if self._is_notebook_run:
            if not os.path.exists(os.path.join(os.getcwd(), os.path.basename(program_relpath))):
                return (None, None)
            if root is None or self._settings.x_jupyter_root is None:
                _logger.info('target path does not exist, exiting')
                return (None, None)
            assert self._settings.x_jupyter_root is not None
            full_program_path = os.path.join(os.path.relpath(str(self._settings.x_jupyter_root), root), program_relpath)
            full_program_path = os.path.normpath(full_program_path)
            if full_program_path.startswith('..'):
                split_path = full_program_path.split('/')
                count_dots = 0
                for p in split_path:
                    if p == '..':
                        count_dots += 1
                full_program_path = '/'.join(split_path[2 * count_dots:])
        else:
            full_program_path = program_relpath
        entrypoint = self._get_entrypoint(full_program_path, metadata)
        source: GitSourceDict = {'git': {'remote': remote, 'commit': commit}, 'entrypoint': entrypoint, 'notebook': self._is_notebook_run, 'build_context': metadata.get('build_context'), 'dockerfile': metadata.get('dockerfile')}
        name = self._make_job_name(f'{remote}_{program_relpath}')
        return (source, name)

    def _log_if_verbose(self, message: str, level: LOG_LEVEL) -> None:
        log_func: Callable[[Any], None] | Callable[[Any], None] | None = None
        if level == 'log':
            _logger.info(message)
            log_func = lumina.termlog
        elif level == 'warn':
            _logger.warning(message)
            log_func = lumina.termwarn
        elif level == 'error':
            _logger.error(message)
            log_func = lumina.termerror
        if self._verbose and log_func is not None:
            log_func(message)

    def _build_artifact_job_source(self, program_relpath: str, metadata: dict[str, Any]) -> tuple[ArtifactSourceDict | None, str | None]:
        assert isinstance(self._logged_code_artifact, dict)
        if self._is_notebook_run and (not self._is_colab_run()):
            full_program_relpath = os.path.relpath(program_relpath, os.getcwd())
            if not os.path.exists(full_program_relpath):
                if not os.path.exists(os.path.basename(program_relpath)):
                    _logger.info('target path does not exist, exiting')
                    self._log_if_verbose('No program path found when generating artifact job source for a non-colab notebook run. See https://docs.wandb.ai/platform/launch/create-job', 'warn')
                    return (None, None)
                full_program_relpath = os.path.basename(program_relpath)
        else:
            full_program_relpath = program_relpath
        entrypoint = self._get_entrypoint(full_program_relpath, metadata)
        source: ArtifactSourceDict = {'entrypoint': entrypoint, 'notebook': self._is_notebook_run, 'artifact': f"wandb-artifact://_id/{self._logged_code_artifact['id']}", 'build_context': metadata.get('build_context'), 'dockerfile': metadata.get('dockerfile')}
        artifact_basename, *_ = self._logged_code_artifact['name'].split(':')
        name = self._make_job_name(artifact_basename)
        return (source, name)

    def _build_image_job_source(self, metadata: dict[str, Any]) -> tuple[ImageSourceDict, str]:
        image_name = metadata.get('docker')
        assert isinstance(image_name, str)
        raw_image_name = image_name
        if ':' in image_name:
            tag = image_name.split(':')[-1]
            if re.fullmatch('([a-zA-Z0-9_\\-\\.]+)', tag):
                raw_image_name = raw_image_name.replace(f':{tag}', '')
                self._aliases += [tag]
        source: ImageSourceDict = {'image': image_name}
        name = self._make_job_name(raw_image_name)
        return (source, name)

    def _make_job_name(self, input_str: str) -> str:
        """Use job name from settings if provided, else use programmatic name."""
        if self._settings.job_name:
            return self._settings.job_name
        return make_artifact_name_safe(f'job-{input_str}')

    def _get_entrypoint(self, program_relpath: str, metadata: dict[str, Any]) -> list[str]:
        if self._partial and metadata.get('entrypoint'):
            entrypoint: list[str] = metadata['entrypoint']
            return entrypoint
        entrypoint = [os.path.basename(sys.executable), program_relpath]
        return entrypoint

    def _get_is_notebook_run(self) -> bool:
        return hasattr(self._settings, '_jupyter') and bool(self._settings._jupyter)

    def _is_colab_run(self) -> bool:
        return hasattr(self._settings, '_colab') and bool(self._settings._colab)

    def _build_job_source(self, source_type: str, program_relpath: str | None, metadata: dict[str, Any]) -> tuple[GitSourceDict | ArtifactSourceDict | ImageSourceDict | None, str | None]:
        """Construct a job source dict and name from the current run.

        Args:
            source_type (str): The type of source to build the job from. One of
                "repo", "artifact", or "image".
        """
        source: GitSourceDict | ArtifactSourceDict | ImageSourceDict | None = None
        if source_type == 'repo':
            source, name = self._build_repo_job_source(program_relpath or '', metadata)
        elif source_type == 'artifact':
            source, name = self._build_artifact_job_source(program_relpath or '', metadata)
        elif source_type == 'image' and self._has_image_job_ingredients(metadata):
            source, name = self._build_image_job_source(metadata)
        else:
            source = None
        if source is None:
            if source_type:
                self._log_if_verbose(f"Source type is set to '{source_type}' but some required information is missing from the environment. A job will not be created from this run. See https://docs.wandb.ai/platform/launch/create-job", 'warn')
            return (None, None)
        return (source, name)

    def build(self, api: Api, build_context: str | None=None, dockerfile: str | None=None, base_image: str | None=None) -> Artifact | None:
        """Build a job artifact from the current run.

        Args:
            api (Api): The API object to use to create the job artifact.
            build_context (Optional[str]): Path within the job source code to
                the image build context. Saved as part of the job for future
                builds.
            dockerfile (Optional[str]): Path within the build context the
                Dockerfile. Saved as part of the job for future builds.
            base_image (Optional[str]): The base image used to run the job code.

        Returns:
            Optional[Artifact]: The job artifact if it was successfully built,
            otherwise None.
        """
        _logger.info('Attempting to build job artifact')
        if self._partial_source_id is not None:
            new_metadata = {'input_types': {'@wandb.config': self.input_types}, 'output_types': self.output_types}
            api.update_artifact_metadata(self._partial_source_id, new_metadata)
            return None
        if not os.path.exists(os.path.join(self._files_dir, REQUIREMENTS_FNAME)):
            self._log_if_verbose('No requirements.txt found, not creating job artifact. See https://docs.wandb.ai/platform/launch/create-job', 'warn')
            return None
        metadata = self._handle_metadata_file()
        if metadata is None:
            self._log_if_verbose(f'Ensure read and write access to run files dir: {self._files_dir}, control this via the WANDB_DIR env var. See https://docs.wandb.ai/models/track/environment-variables', 'warn')
            return None
        runtime: str | None = metadata.get('python')
        if runtime is None:
            self._log_if_verbose('No python version found in metadata, not creating job artifact. See https://docs.wandb.ai/platform/launch/create-job', 'warn')
            return None
        input_types = TypeRegistry.type_of(self._config).to_json()
        output_types = TypeRegistry.type_of(self._summary).to_json()
        name: str | None = None
        source_info: JobSourceDict | None = None
        source_type = self._get_source_type(metadata)
        if not source_type:
            if self._settings.job_name or self._settings.job_source or self._source_type:
                self._log_if_verbose('No source type found, not creating job artifact', 'warn')
            return None
        program_relpath = self._get_program_relpath(source_type, metadata)
        if not self._partial and source_type != 'image' and (not program_relpath):
            self._log_if_verbose('No program path found, not creating job artifact. See https://docs.wandb.ai/platform/launch/create-job', 'warn')
            return None
        source, name = self._build_job_source(source_type, program_relpath, metadata)
        if source is None:
            return None
        if build_context:
            source['build_context'] = build_context
        if dockerfile:
            source['dockerfile'] = dockerfile
        if base_image:
            source['base_image'] = base_image
        for key in list(source.keys()):
            if source[key] is None:
                source.pop(key)
        source_info = {'_version': str(get_min_supported_for_source_dict(source) or 'v0'), 'source_type': source_type, 'source': source, 'input_types': input_types, 'output_types': output_types, 'runtime': runtime}
        if self._services:
            source_info['services'] = self._services
        assert source_info is not None
        assert name is not None
        artifact = InternalArtifact(name, JOB_ARTIFACT_TYPE)
        _logger.info('adding wandb-job metadata file')
        with artifact.new_file('wandb-job.json') as f:
            f.write(json.dumps(source_info, indent=4))
        artifact.add_file(os.path.join(self._files_dir, REQUIREMENTS_FNAME), name=FROZEN_REQUIREMENTS_FNAME)
        if source_type == 'repo' and os.path.exists(os.path.join(self._files_dir, DIFF_FNAME)):
            artifact.add_file(os.path.join(self._files_dir, DIFF_FNAME), name=DIFF_FNAME)
        return artifact

    def _get_source_type(self, metadata: dict[str, Any]) -> str | None:
        if self._source_type:
            return self._source_type
        if self._has_git_job_ingredients(metadata):
            _logger.info('is repo sourced job')
            return 'repo'
        if self._has_artifact_job_ingredients():
            _logger.info('is artifact sourced job')
            return 'artifact'
        if self._has_image_job_ingredients(metadata):
            _logger.info('is image sourced job')
            return 'image'
        _logger.info('no source found')
        return None

    def _get_program_relpath(self, source_type: str, metadata: dict[str, Any]) -> str | None:
        if self._is_notebook_run:
            _logger.info('run is notebook based run')
            program = metadata.get('program')
            if not program:
                self._log_if_verbose("Notebook 'program' path not found in metadata. See https://docs.wandb.ai/platform/launch/create-job", 'warn')
            return program
        if source_type == 'artifact' or self._settings.job_source == 'artifact':
            return metadata.get('codePathLocal') or metadata.get('codePath')
        return metadata.get('codePath')

    def _handle_metadata_file(self) -> dict | None:
        if os.path.exists(os.path.join(self._files_dir, METADATA_FNAME)):
            with open(os.path.join(self._files_dir, METADATA_FNAME)) as f:
                metadata: dict = json.load(f)
            return metadata
        return None

    def _has_git_job_ingredients(self, metadata: dict[str, Any]) -> bool:
        git_info: dict[str, str] = metadata.get('git', {})
        if self._is_notebook_run and metadata.get('root') is None:
            return False
        return git_info.get('remote') is not None and git_info.get('commit') is not None

    def _has_artifact_job_ingredients(self) -> bool:
        return self._logged_code_artifact is not None

    def _has_image_job_ingredients(self, metadata: dict[str, Any]) -> bool:
        return metadata.get('docker') is not None
