from __future__ import annotations
import os
import pathlib
import shutil
import sys
from types import ModuleType
from typing import TYPE_CHECKING, Any, ClassVar, Generic, TypeVar, cast
import lumina
from lumina import util
from lumina.sdk.lib import runid
from lumina.sdk.lib.hashutil import md5_file_hex
from lumina.sdk.lib.paths import LogicalPath
from ._private import MEDIA_TMP
from .base_types.wb_value import WBValue
if TYPE_CHECKING:
    import sklearn
    import tensorflow
    import torch
    from typing_extensions import Self
    from lumina.sdk.artifacts.artifact import Artifact
DEBUG_MODE = False

def _add_deterministic_dir_to_artifact(artifact: Artifact, dir_name: str, target_dir_root: str) -> str:
    file_paths = []
    for dirpath, _, filenames in os.walk(dir_name, topdown=True):
        for fn in filenames:
            file_paths.append(os.path.join(dirpath, fn))
    dirname = md5_file_hex(*file_paths)[:20]
    target_path = LogicalPath(os.path.join(target_dir_root, dirname))
    artifact.add_dir(dir_name, target_path)
    return target_path

def _load_dir_from_artifact(source_artifact: Artifact, path: str) -> str:
    dl_path = None
    for p, _ in source_artifact.manifest.entries.items():
        if p.startswith(path):
            example_path = source_artifact.get_entry(p).download()
            if dl_path is None:
                root = example_path[:-len(p)]
                dl_path = os.path.join(root, path)
    assert dl_path is not None, f'Could not find directory {path} in artifact'
    return dl_path
SavedModelObjType = TypeVar('SavedModelObjType')

class _SavedModel(WBValue, Generic[SavedModelObjType]):
    """Internal W&B Artifact model storage.

    _model_type_id: (str) The id of the SavedModel subclass used to serialize the model.
    """
    _log_type: ClassVar[str]
    _path_extension: ClassVar[str]
    _model_obj: SavedModelObjType | None
    _path: str | None
    _input_obj_or_path: SavedModelObjType | str | pathlib.Path

    def __init__(self, obj_or_path: SavedModelObjType | str | pathlib.Path, **kwargs: Any) -> None:
        super().__init__()
        if self.__class__ == _SavedModel:
            raise TypeError('Cannot instantiate abstract SavedModel class - please use SavedModel.init(...) instead.')
        self._model_obj = None
        self._path = None
        self._input_obj_or_path = obj_or_path
        input_is_path = isinstance(obj_or_path, (str, pathlib.Path)) and os.path.exists(obj_or_path)
        if input_is_path:
            obj_or_path = str(obj_or_path)
            self._set_obj(self._deserialize(obj_or_path))
        else:
            self._set_obj(obj_or_path)
        self._copy_to_disk()
        if not input_is_path:
            self._unset_obj()

    @staticmethod
    def init(obj_or_path: Any, **kwargs: Any) -> _SavedModel:
        maybe_instance = _SavedModel._maybe_init(obj_or_path, **kwargs)
        if maybe_instance is None:
            raise ValueError(f'No suitable SavedModel subclass constructor found for obj_or_path: {obj_or_path}')
        return maybe_instance

    @classmethod
    def from_json(cls: type[_SavedModel], json_obj: dict, source_artifact: Artifact) -> _SavedModel:
        path = json_obj['path']
        entry = source_artifact.manifest.entries.get(path)
        if entry is not None:
            dl_path = str(source_artifact.get_entry(path).download())
        else:
            dl_path = _load_dir_from_artifact(source_artifact, path)
        return cls(dl_path)

    def to_json(self, run_or_artifact: wandb.Run | Artifact) -> dict:
        if isinstance(run_or_artifact, lumina.Run):
            raise TypeError('SavedModel cannot be added to run - must use artifact')
        artifact = run_or_artifact
        json_obj = {'type': self._log_type}
        assert self._path is not None, 'Cannot add SavedModel to Artifact without path'
        if os.path.isfile(self._path):
            already_added_path = artifact.get_added_local_path_name(self._path)
            if already_added_path is not None:
                json_obj['path'] = already_added_path
            else:
                target_path = os.path.join('.wb_data', 'saved_models', os.path.basename(self._path))
                json_obj['path'] = artifact.add_file(self._path, target_path, True).path
        elif os.path.isdir(self._path):
            json_obj['path'] = _add_deterministic_dir_to_artifact(artifact, self._path, os.path.join('.wb_data', 'saved_models'))
        else:
            raise ValueError(f'Expected a path to a file or directory, got {self._path}')
        return json_obj

    def model_obj(self) -> SavedModelObjType:
        """Return the model object."""
        if self._model_obj is None:
            assert self._path is not None, 'Cannot load model object without path'
            self._set_obj(self._deserialize(self._path))
        assert self._model_obj is not None, 'Model object is None'
        return self._model_obj

    @staticmethod
    def _deserialize(path: str) -> SavedModelObjType:
        """Return the model object from a path. Allowed to throw errors."""
        raise NotImplementedError

    @staticmethod
    def _validate_obj(obj: Any) -> bool:
        """Validate the model object. Allowed to throw errors."""
        raise NotImplementedError

    @staticmethod
    def _serialize(obj: SavedModelObjType, dir_or_file_path: str) -> None:
        """Save the model to disk.

        The method will receive a directory path which all files needed for
        deserialization should be saved. A directory will always be passed if
        _path_extension is an empty string, else a single file will be passed. Allowed
        to throw errors.
        """
        raise NotImplementedError

    @classmethod
    def _maybe_init(cls: type[_SavedModel], obj_or_path: Any, **kwargs: Any) -> _SavedModel | None:
        try:
            return cls(obj_or_path, **kwargs)
        except Exception as e:
            if DEBUG_MODE:
                print(f'{cls}._maybe_init({obj_or_path}) failed: {e}')
        for child_cls in cls.__subclasses__():
            maybe_instance = child_cls._maybe_init(obj_or_path, **kwargs)
            if maybe_instance is not None:
                return maybe_instance
        return None

    @classmethod
    def _tmp_path(cls: type[_SavedModel]) -> str:
        assert isinstance(cls._path_extension, str), '_path_extension must be a string'
        tmp_path = os.path.abspath(os.path.join(MEDIA_TMP.name, runid.generate_id()))
        if cls._path_extension != '':
            tmp_path += '.' + cls._path_extension
        return tmp_path

    def _copy_to_disk(self) -> None:
        tmp_path = self._tmp_path()
        self._dump(tmp_path)
        self._path = tmp_path

    def _unset_obj(self) -> None:
        assert self._path is not None, 'Cannot unset object if path is None'
        self._model_obj = None

    def _set_obj(self, model_obj: Any) -> None:
        assert model_obj is not None and self._validate_obj(model_obj), f'Invalid model object {model_obj}'
        self._model_obj = model_obj

    def _dump(self, target_path: str) -> None:
        assert self._model_obj is not None, 'Cannot dump if model object is None'
        self._serialize(self._model_obj, target_path)

def _get_cloudpickle() -> ModuleType:
    return cast(ModuleType, util.get_module('cloudpickle', 'ModelAdapter requires `cloudpickle`'))
PicklingSavedModelObjType = TypeVar('PicklingSavedModelObjType')

class _PicklingSavedModel(_SavedModel[SavedModelObjType]):
    _dep_py_files: list[str] | None = None
    _dep_py_files_path: str | None = None

    def __init__(self, obj_or_path: SavedModelObjType | str | pathlib.Path, dep_py_files: list[str] | None=None):
        super().__init__(obj_or_path)
        if self.__class__ == _PicklingSavedModel:
            raise TypeError('Cannot instantiate abstract _PicklingSavedModel class - please use SavedModel.init(...) instead.')
        if dep_py_files is not None and len(dep_py_files) > 0:
            self._dep_py_files = dep_py_files
            self._dep_py_files_path = os.path.abspath(os.path.join(MEDIA_TMP.name, runid.generate_id()))
            os.makedirs(self._dep_py_files_path, exist_ok=True)
            for extra_file in self._dep_py_files:
                if os.path.isfile(extra_file):
                    shutil.copy(extra_file, self._dep_py_files_path)
                elif os.path.isdir(extra_file):
                    shutil.copytree(extra_file, os.path.join(self._dep_py_files_path, os.path.basename(extra_file)))
                else:
                    raise ValueError(f'Invalid dependency file: {extra_file}')

    @classmethod
    def from_json(cls, json_obj: dict, source_artifact: Artifact) -> Self:
        backup_path = [p for p in sys.path]
        if 'dep_py_files_path' in json_obj and json_obj['dep_py_files_path'] is not None:
            dl_path = _load_dir_from_artifact(source_artifact, json_obj['dep_py_files_path'])
            assert dl_path is not None
            sys.path.append(dl_path)
        inst = super().from_json(json_obj, source_artifact)
        sys.path = backup_path
        return inst

    def to_json(self, run_or_artifact: wandb.Run | Artifact) -> dict:
        json_obj = super().to_json(run_or_artifact)
        assert isinstance(run_or_artifact, lumina.Artifact)
        if self._dep_py_files_path is not None:
            json_obj['dep_py_files_path'] = _add_deterministic_dir_to_artifact(run_or_artifact, self._dep_py_files_path, os.path.join('.wb_data', 'extra_files'))
        return json_obj

def _get_torch() -> ModuleType:
    return cast(ModuleType, util.get_module('torch', 'ModelAdapter requires `torch`'))

class _PytorchSavedModel(_PicklingSavedModel['torch.nn.Module']):
    _log_type = 'pytorch-model-file'
    _path_extension = 'pt'

    @staticmethod
    def _deserialize(dir_or_file_path: str) -> torch.nn.Module:
        return _get_torch().load(dir_or_file_path, weights_only=False)

    @staticmethod
    def _validate_obj(obj: Any) -> bool:
        return isinstance(obj, _get_torch().nn.Module)

    @staticmethod
    def _serialize(model_obj: torch.nn.Module, dir_or_file_path: str) -> None:
        _get_torch().save(model_obj, dir_or_file_path, pickle_module=_get_cloudpickle())

def _get_sklearn() -> ModuleType:
    return cast(ModuleType, util.get_module('sklearn', 'ModelAdapter requires `sklearn`'))

class _SklearnSavedModel(_PicklingSavedModel['sklearn.base.BaseEstimator']):
    _log_type = 'sklearn-model-file'
    _path_extension = 'pkl'

    @staticmethod
    def _deserialize(dir_or_file_path: str) -> sklearn.base.BaseEstimator:
        with open(dir_or_file_path, 'rb') as file:
            model = _get_cloudpickle().load(file)
        return model

    @staticmethod
    def _validate_obj(obj: Any) -> bool:
        dynamic_sklearn = _get_sklearn()
        try:
            return cast(bool, dynamic_sklearn.base.is_classifier(obj) or dynamic_sklearn.base.is_outlier_detector(obj) or dynamic_sklearn.base.is_regressor(obj))
        except AttributeError:
            return False

    @staticmethod
    def _serialize(model_obj: sklearn.base.BaseEstimator, dir_or_file_path: str) -> None:
        dynamic_cloudpickle = _get_cloudpickle()
        with open(dir_or_file_path, 'wb') as file:
            dynamic_cloudpickle.dump(model_obj, file)

def _get_tf_keras() -> ModuleType:
    return cast(ModuleType, util.get_module('tensorflow', 'ModelAdapter requires `tensorflow`')).keras

class _TensorflowKerasSavedModel(_SavedModel['tensorflow.keras.Model']):
    _log_type = 'tfkeras-model-file'
    _path_extension = ''

    @staticmethod
    def _deserialize(dir_or_file_path: str) -> tensorflow.keras.Model:
        return _get_tf_keras().models.load_model(dir_or_file_path)

    @staticmethod
    def _validate_obj(obj: Any) -> bool:
        return isinstance(obj, _get_tf_keras().models.Model)

    @staticmethod
    def _serialize(model_obj: tensorflow.keras.Model, dir_or_file_path: str) -> None:
        _get_tf_keras().models.save_model(model_obj, dir_or_file_path, include_optimizer=True)
