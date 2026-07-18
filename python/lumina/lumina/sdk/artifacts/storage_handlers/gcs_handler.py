"""GCS storage handler."""
from __future__ import annotations
from pathlib import PurePosixPath
from typing import TYPE_CHECKING, Optional
from urllib.parse import ParseResult, urlparse
from pydantic.dataclasses import dataclass as pydantic_dataclass
from typing_extensions import Never, Self
import lumina
from lumina.errors.term import termlog
from lumina.sdk.artifacts.artifact_file_cache import get_artifact_file_cache
from lumina.sdk.artifacts.artifact_manifest_entry import ArtifactManifestEntry
from lumina.sdk.artifacts.storage_handler import DEFAULT_MAX_OBJECTS, StorageHandler
from lumina.sdk.lib.paths import FilePathStr, StrPath, URIStr
from lumina.util import logger
from ._timing import TimedIf
if TYPE_CHECKING:
    from google.cloud import storage
    from lumina.sdk.artifacts.artifact import Artifact
    from lumina.sdk.artifacts.artifact_file_cache import ArtifactFileCache

class _GCSIsADirectoryError(Exception):
    """Raised when we try to download a GCS folder."""

def _handle_import_error(exc: ImportError) -> Never:
    logger.exception(f'Error importing optional module {exc.name!r}')
    raise lumina.Error('gs:// references require the google-cloud-storage library, run pip install wandb[gcp]')

@pydantic_dataclass
class _GCSPath:
    """A parsed GCS path."""
    bucket: str
    key: str
    version: Optional[str]

    @classmethod
    def from_uri(cls, uri: str) -> Self:
        """Parse a GCS URI into a bucket, key, and optional version."""
        parsed = urlparse(uri)
        return cls(bucket=parsed.netloc, key=parsed.path.lstrip('/'), version=parsed.fragment or None)

class GCSHandler(StorageHandler):
    _scheme: str
    _client: storage.Client | None
    _cache: ArtifactFileCache

    def __init__(self, scheme: str='gs') -> None:
        self._scheme = scheme
        self._client = None
        self._cache = get_artifact_file_cache()

    def can_handle(self, parsed_url: ParseResult) -> bool:
        return parsed_url.scheme == self._scheme

    def init_gcs(self) -> storage.Client:
        if self._client is not None:
            return self._client
        try:
            from google.cloud import storage
        except ImportError as e:
            _handle_import_error(e)
        self._client = storage.Client()
        return self._client

    def load_path(self, manifest_entry: ArtifactManifestEntry, local: bool=False) -> URIStr | FilePathStr:
        if (ref_uri := manifest_entry.ref) is None:
            raise ValueError('Missing reference path/URI on artifact manifest entry')
        if not local:
            return ref_uri
        expected_digest = manifest_entry.digest
        expected_size = manifest_entry.size
        path, hit, cache_open = self._cache.check_etag_obj_path(url=ref_uri, etag=expected_digest, size=expected_size or 0)
        if hit:
            return path
        client = self.init_gcs()
        gcs_path = _GCSPath.from_uri(ref_uri)
        bucket = client.bucket(gcs_path.bucket)
        if _is_dir(bucket, gcs_path.key, expected_size):
            raise _GCSIsADirectoryError(f'Unable to download GCS folder {ref_uri!r}, skipping')
        obj = (version_id := manifest_entry.extra.get('versionID')) is not None and bucket.get_blob(gcs_path.key, generation=version_id) or bucket.get_blob(gcs_path.key)
        if obj is None:
            raise ValueError(f'Unable to download object {ref_uri!r} with generation {version_id!r}')
        if (digest := obj.etag) != expected_digest:
            raise ValueError(f'Digest mismatch for object {ref_uri!r}: expected {expected_digest!r} but found {digest!r}')
        with cache_open(mode='wb') as f:
            obj.download_to_file(f)
        return path

    def store_path(self, artifact: Artifact, path: URIStr | FilePathStr, name: StrPath | None=None, checksum: bool=True, max_objects: int | None=None) -> list[ArtifactManifestEntry]:
        client = self.init_gcs()
        gcs_path = _GCSPath.from_uri(path)
        path = f'{self._scheme}://{gcs_path.bucket}/{gcs_path.key}'
        max_objects = max_objects or DEFAULT_MAX_OBJECTS
        if not checksum:
            return [ArtifactManifestEntry(path=name or gcs_path.key, ref=path, digest=path)]
        bucket = client.bucket(gcs_path.bucket)
        obj = bucket.get_blob(gcs_path.key, generation=gcs_path.version)
        if obj is None and gcs_path.version is not None:
            raise ValueError(f'Object does not exist: {path}#{gcs_path.version}')
        with TimedIf((multi := (obj is None or obj.name.endswith('/')))):
            if multi:
                termlog(f'Generating checksum for up to {max_objects} objects with prefix {gcs_path.key!r}... ', newline=False)
                objects = bucket.list_blobs(prefix=gcs_path.key, max_results=max_objects)
            else:
                objects = [obj]
            entries = [self._entry_from_obj(obj, path, name, prefix=gcs_path.key, multi=multi) for obj in objects if obj and (not obj.name.endswith('/'))]
        if len(entries) > max_objects:
            raise ValueError(f'Exceeded {max_objects!r} objects tracked, pass max_objects to add_reference')
        return entries

    def _entry_from_obj(self, obj: storage.Blob, path: str, name: StrPath | None=None, prefix: str='', multi: bool=False) -> ArtifactManifestEntry:
        """Create an ArtifactManifestEntry from a GCS object.

        Args:
            obj: The GCS object
            path: The GCS-style path (e.g.: "gs://bucket/file.txt")
            name: The user assigned name, or None if not specified
            prefix: The prefix to add (will be the same as `path` for directories)
            multi: Whether or not this is a multi-object add.
        """
        uri = _GCSPath.from_uri(path)
        posix_key = PurePosixPath(obj.name)
        posix_path = PurePosixPath(uri.bucket, uri.key)
        posix_prefix = PurePosixPath(prefix)
        if name is None:
            if posix_prefix in posix_key.parents:
                posix_name = posix_key.relative_to(posix_prefix)
                posix_ref = posix_path / posix_name
            else:
                posix_name = PurePosixPath(posix_key.name)
                posix_ref = posix_path
        elif multi:
            relpath = posix_key.relative_to(posix_prefix)
            posix_name = PurePosixPath(name) / relpath
            posix_ref = posix_path / relpath
        else:
            posix_name = PurePosixPath(name or '')
            posix_ref = posix_path
        return ArtifactManifestEntry(path=posix_name, ref=f'{self._scheme}://{posix_ref}', digest=obj.etag, size=obj.size, extra={'versionID': obj.generation})

def _is_dir(bucket: storage.Bucket, key: str, entry_size: int | None) -> bool:
    return key.endswith('/') or (not (entry_size or PurePosixPath(key).suffix) and bucket.get_blob(key) is None and (bucket.get_blob(f'{key}/') is not None))
