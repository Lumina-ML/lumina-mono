from __future__ import annotations
import re
import sys
from contextlib import AbstractContextManager
from types import TracebackType
from typing import TYPE_CHECKING
import lumina
from lumina.proto.wandb_telemetry_pb2 import Imports as TelemetryImports
from lumina.proto.wandb_telemetry_pb2 import TelemetryRecord
if TYPE_CHECKING:
    from .. import wandb_run
_LABEL_TOKEN: str = '@wandbcode{'

class _TelemetryObject:
    _run: wandb_run.Run | None
    _obj: TelemetryRecord

    def __init__(self, run: wandb_run.Run | None=None, obj: TelemetryRecord | None=None) -> None:
        self._run = run or lumina.run
        self._obj = obj or TelemetryRecord()

    def __enter__(self) -> TelemetryRecord:
        return self._obj

    def __exit__(self, exctype: type[BaseException] | None, excinst: BaseException | None, exctb: TracebackType | None) -> None:
        if not self._run:
            return
        self._run._telemetry_callback(self._obj)

def context(run: wandb_run.Run | None=None, obj: TelemetryRecord | None=None) -> AbstractContextManager[TelemetryRecord]:
    return _TelemetryObject(run=run, obj=obj)
MATCH_RE = re.compile('(?P<code>[a-zA-Z0-9_-]+)[,}](?P<rest>.*)')

def list_telemetry_imports(only_imported: bool=False) -> set[str]:
    import_telemetry_set = {desc.name for desc in TelemetryImports.DESCRIPTOR.fields if desc.type == desc.TYPE_BOOL}
    if only_imported:
        imported_modules_set = set(sys.modules)
        return imported_modules_set.intersection(import_telemetry_set)
    return import_telemetry_set
__all__ = ['TelemetryImports', 'TelemetryRecord', 'context', 'list_telemetry_imports']
