from __future__ import annotations
import hashlib
import os
import pathlib
import re
import shutil
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, cast
import lumina
from lumina import util
from lumina.sdk.lib import filesystem
from lumina.sdk.lib.paths import LogicalPath
from .wb_value import WBValue
if TYPE_CHECKING:
    import numpy as np
    from lumina.sdk.artifacts.artifact import Artifact

def _wb_filename(key: str | int, step: str | int, id: str | int, extension: str) -> str:
    """Generates a safe filename/path for storing media files, using the provided key, step, and id.

    If the key contains slashes (e.g. 'images/cats/fluffy.jpg'), subdirectories will be created:
        media/
          images/
            cats/
              fluffy.jpg_step_id.ext

    Args:
        key: Name/path for the media file
        step: Training step number
        id: Unique identifier
        extension: File extension (e.g. '.jpg', '.mp3')

    Returns:
        A sanitized filename string in the format: key_step_id.extension

    Raises:
        ValueError: If running on Windows and the key contains invalid filename characters
                   (\\\\, :, *, ?, ", <, >, |)
    """
    key = util.make_file_path_upload_safe(str(key))
    return f'{str(key)}_{str(step)}_{str(id)}{extension}'

class Media(WBValue):
    """A WBValue stored as a file outside JSON that can be rendered in a media panel.

    If necessary, we move or copy the file into the Run's media directory so that it
    gets uploaded.
    """
    _path: str | None
    _run: lumina.Run | None
    _caption: str | None
    _is_tmp: bool | None
    _extension: str | None
    _sha256: str | None
    _size: int | None

    def __init__(self, caption: str | None=None) -> None:
        super().__init__()
        self._path = None
        self._run = None
        self._caption = caption

    def _set_file(self, path: str, is_tmp: bool=False, extension: str | None=None) -> None:
        self._path = path
        self._is_tmp = is_tmp
        self._extension = extension
        assert extension is None or path.endswith(extension), f'Media file extension "{extension}" must occur at the end of path "{path}".'
        with open(self._path, 'rb') as f:
            self._sha256 = hashlib.sha256(f.read()).hexdigest()
        self._size = os.path.getsize(self._path)

    @classmethod
    def get_media_subdir(cls: type[Media]) -> str:
        raise NotImplementedError

    @staticmethod
    def captions(media_items: Sequence[Media]) -> bool | Sequence[str | None]:
        if media_items[0]._caption is not None:
            return [m._caption for m in media_items]
        else:
            return False

    def is_bound(self) -> bool:
        return self._run is not None

    def file_is_set(self) -> bool:
        return self._path is not None and self._sha256 is not None

    def bind_to_run(self, run: wandb.Run, key: int | str, step: int | str, id_: int | str | None=None, ignore_copy_err: bool | None=None) -> None:
        """Bind this object to a particular Run.

        Calling this function is necessary so that we have somewhere specific to put the
        file associated with this object, from which other Runs can refer to it.
        """
        assert self.file_is_set(), 'bind_to_run called before _set_file'
        assert isinstance(self._path, str)
        assert isinstance(self._sha256, str)
        assert run is not None, 'Argument "run" must not be None.'
        self._run = run
        if self._extension is None:
            _, extension = os.path.splitext(os.path.basename(self._path))
        else:
            extension = self._extension
        if id_ is None:
            id_ = self._sha256[:20]
        file_path = _wb_filename(key, step, id_, extension)
        media_path = os.path.join(self.get_media_subdir(), file_path)
        new_path = os.path.join(self._run.dir, media_path)
        filesystem.mkdir_exists_ok(os.path.dirname(new_path))
        if self._is_tmp:
            shutil.move(self._path, new_path)
            self._path = new_path
            self._is_tmp = False
        elif run._settings.allow_media_symlink:
            filesystem.link_or_copy(run._settings, pathlib.Path(self._path).resolve(), pathlib.Path(new_path))
            self._path = new_path
        else:
            try:
                shutil.copy(self._path, new_path)
            except shutil.SameFileError:
                if not ignore_copy_err:
                    raise
            self._path = new_path
        run._publish_file(media_path)

    def to_json(self, run: wandb.Run | Artifact) -> dict:
        """Serialize the object into a JSON blob.

        Uses run or artifact to store additional data. If `run_or_artifact` is a
        wandb.Run then `self.bind_to_run()` must have been previously been called.

        Args:
            run_or_artifact (wandb.Run | wandb.Artifact): the Run or Artifact for which
                this object should be generating JSON for - this is useful to store
                additional data if needed.

        Returns:
            dict: JSON representation
        """
        from lumina import Image
        from lumina.data_types import Audio
        json_obj: dict[str, Any] = {}
        if self._caption is not None:
            json_obj['caption'] = self._caption
        if isinstance(run, lumina.Run):
            json_obj.update({'_type': 'file', 'sha256': self._sha256, 'size': self._size})
            artifact_entry_url = self._get_artifact_entry_ref_url()
            if artifact_entry_url is not None:
                json_obj['artifact_path'] = artifact_entry_url
            artifact_entry_latest_url = self._get_artifact_entry_latest_ref_url()
            if artifact_entry_latest_url is not None:
                json_obj['_latest_artifact_path'] = artifact_entry_latest_url
            if artifact_entry_url is None or self.is_bound():
                assert self.is_bound(), f'Value of type {type(self).__name__} must be bound to a run with bind_to_run() before being serialized to JSON.'
                assert self._run is run, "We don't support referring to media files across runs."
                assert isinstance(self._path, str)
                json_obj['path'] = LogicalPath(os.path.relpath(self._path, self._run.dir))
        elif isinstance(run, lumina.Artifact):
            if self.file_is_set():
                assert isinstance(self._path, str)
                assert isinstance(self._sha256, str)
                artifact = run
                name = artifact.get_added_local_path_name(self._path)
                if name is None:
                    if self._is_tmp:
                        name = os.path.join(self.get_media_subdir(), os.path.basename(self._path))
                    else:
                        name = os.path.join(self.get_media_subdir(), self._sha256[:20], os.path.basename(self._path))
                    if self._artifact_source is not None:
                        default_root = self._artifact_source.artifact._default_root()
                        if self._path.startswith(default_root):
                            name = self._path[len(default_root):]
                            name = name.lstrip(os.sep)
                        path = self._artifact_source.artifact.get_entry(name)
                        artifact.add_reference(path.ref_url(), name=name)
                    elif isinstance(self, (Audio, Image)) and Media.path_is_reference(self._path):
                        artifact.add_reference(self._path, name=name)
                    else:
                        entry = artifact.add_file(self._path, name=name, is_tmp=self._is_tmp)
                        name = entry.path
                json_obj['path'] = name
                json_obj['sha256'] = self._sha256
            json_obj['_type'] = self._log_type
        return json_obj

    @classmethod
    def from_json(cls: type[Media], json_obj: dict, source_artifact: Artifact) -> Media:
        """Likely will need to override for any more complicated media objects."""
        return cls(source_artifact.get_entry(json_obj['path']).download())

    def __eq__(self, other: object) -> bool:
        """Likely will need to override for any more complicated media objects."""
        return isinstance(other, self.__class__) and hasattr(self, '_sha256') and hasattr(other, '_sha256') and (self._sha256 == other._sha256)

    @staticmethod
    def path_is_reference(path: str | pathlib.Path | None) -> bool:
        if path is None or isinstance(path, pathlib.Path):
            return False
        return bool(path and re.match('^(gs|s3|https?)://', path))

class BatchableMedia(Media):
    """Media that is treated in batches.

    E.g. images and thumbnails. Apart from images, we just use these batches to help
    organize files by name in the media directory.
    """

    def __init__(self, caption: str | None=None) -> None:
        super().__init__(caption=caption)

    @classmethod
    def seq_to_json(cls: type[BatchableMedia], seq: Sequence[BatchableMedia], run: wandb.Run, key: str, step: int | str) -> dict:
        raise NotImplementedError

def _numpy_arrays_to_lists(payload: dict | Sequence | np.ndarray) -> Sequence | dict | str | int | float | bool:
    if isinstance(payload, dict):
        res = {}
        for key, val in payload.items():
            res[key] = _numpy_arrays_to_lists(val)
        return res
    elif isinstance(payload, Sequence) and (not isinstance(payload, str)):
        return [_numpy_arrays_to_lists(v) for v in payload]
    elif util.is_numpy_array(payload):
        if TYPE_CHECKING:
            payload = cast('np.ndarray', payload)
        return [_numpy_arrays_to_lists(v) for v in (payload.tolist() if payload.ndim > 0 else [payload.tolist()])]
    elif isinstance(payload, Media):
        return str(payload.__class__.__name__)
    return payload
