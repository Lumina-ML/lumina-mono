from __future__ import annotations
import datetime
import logging
import os
from collections.abc import Sequence
from decimal import Decimal
from typing import TYPE_CHECKING, Any, TypeAlias, cast
import lumina
from lumina import util
from ..internal import incremental_table_util
from .base_types.media import BatchableMedia, Media
from .base_types.wb_value import WBValue
from .image import _server_accepts_image_filenames
from .plotly import Plotly
if TYPE_CHECKING:
    import matplotlib
    import pandas as pd
    import plotly
    from ..wandb_run import Run as LocalRun
    ValToJsonType: TypeAlias = dict | WBValue | Sequence[WBValue] | plotly.Figure | matplotlib.artist.Artist | pd.DataFrame | object

def history_dict_to_json(run: LocalRun | None, payload: dict, step: int | None=None, ignore_copy_err: bool | None=None) -> dict:
    if step is None:
        step = payload['_step']
    for key in list(payload):
        val = payload[key]
        if isinstance(val, dict):
            payload[key] = history_dict_to_json(run, val, step=step, ignore_copy_err=ignore_copy_err)
        else:
            payload[key] = val_to_json(run, key, val, namespace=step, ignore_copy_err=ignore_copy_err)
    return payload

def val_to_json(run: LocalRun | None, key: str, val: ValToJsonType, namespace: str | int | None=None, ignore_copy_err: bool | None=None) -> Any:
    if namespace is None:
        raise ValueError("val_to_json must be called with a namespace(a step number, or 'summary') argument")
    converted = val
    if isinstance(val, (int, float, str, bool)):
        return converted
    typename = util.get_full_typename(val)
    if util.is_pandas_data_frame(val):
        if TYPE_CHECKING:
            val = cast('pd.DataFrame', val)
        val = lumina.Table(dataframe=val)
    elif util.is_matplotlib_typename(typename) or util.is_plotly_typename(typename):
        val = Plotly.make_plot_media(val)
    elif isinstance(val, (list, tuple, range)) and all((isinstance(v, WBValue) for v in val)):
        assert run
        if len(val) and isinstance(val[0], BatchableMedia) and all((isinstance(v, type(val[0])) for v in val)):
            if TYPE_CHECKING:
                val = cast(Sequence['BatchableMedia'], val)
            items = _prune_max_seq(val)
            if _server_accepts_image_filenames(run):
                for item in items:
                    item.bind_to_run(run=run, key=key, step=namespace, ignore_copy_err=ignore_copy_err)
            else:
                for i, item in enumerate(items):
                    item.bind_to_run(run=run, key=key, step=namespace, id_=i, ignore_copy_err=ignore_copy_err)
                if run._attach_id and run._init_pid != os.getpid():
                    lumina.termwarn(f'Attempting to log a sequence of {items[0].__class__.__name__} objects from multiple processes might result in data loss. Please upgrade your wandb server', repeat=False)
            return items[0].seq_to_json(items, run, key, namespace)
        else:
            return [val_to_json(run, key, v, namespace=namespace, ignore_copy_err=ignore_copy_err) for v in val]
    if isinstance(val, WBValue):
        assert run
        if isinstance(val, Media) and (not val.is_bound()):
            if hasattr(val, '_log_type') and val._log_type in ['table', 'partitioned-table', 'joined-table']:
                _log_table_artifact(val, key, run)
            if not (hasattr(val, '_log_type') and val._log_type in ['partitioned-table', 'joined-table']):
                val.bind_to_run(run, key, namespace)
        res = val.to_json(run)
        if isinstance(val, lumina.Table) and val.log_mode == 'INCREMENTAL':
            val._last_logged_idx = len(val.data) - 1
        return res
    return converted

def _log_table_artifact(val: Media, key: str, run: LocalRun) -> None:
    """Log a table to the run based on the table type and logging mode.

    Creates and logs a `run_table` type for Table, PartitionedTable, and
    JoinedTable values. For tables with log_mode="INCREMENTAL", creates and
    logs an incremental artifact of type `wandb-run-incremental-table.`

    Args:
        val: A wbvalue with log_type "table", "partitioned-table",
            or "joined-table."
        key: The key used to log val.
        run: The LocalRun used to log val.
    """
    from lumina.sdk.artifacts._internal_artifact import InternalArtifact
    if isinstance(val, lumina.Table) and val.log_mode == 'INCREMENTAL':
        if run.resumed and val._previous_increments_paths is None and (val._increment_num is None):
            val._load_incremental_table_state_from_resumed_run(run, key)
        else:
            val._set_incremental_table_run_target(run)
        art = incremental_table_util.init_artifact(run, key)
        entry_name = incremental_table_util.get_entry_name(val, key)
    else:
        art = InternalArtifact(f'run-{run.id}-{key}', 'run_table')
        entry_name = key
    art.add(val, entry_name)
    run.log_artifact(art)

def _prune_max_seq(seq: Sequence[BatchableMedia]) -> Sequence[BatchableMedia]:
    items = seq
    if hasattr(seq[0], 'MAX_ITEMS') and seq[0].MAX_ITEMS < len(seq):
        logging.warning(f'Only {seq[0].MAX_ITEMS} {seq[0].__class__.__name__} will be uploaded.')
        items = seq[:seq[0].MAX_ITEMS]
    return items

def _json_helper(val, artifact):
    if isinstance(val, WBValue):
        return val.to_json(artifact)
    elif val.__class__ is dict:
        res = {}
        for key in val:
            res[key] = _json_helper(val[key], artifact)
        return res
    if hasattr(val, 'tolist'):
        py_val = val.tolist()
        if val.__class__.__name__ == 'datetime64' and isinstance(py_val, int):
            return _json_helper(py_val / int(1000000.0), artifact)
        return _json_helper(py_val, artifact)
    elif hasattr(val, 'item'):
        return _json_helper(val.item(), artifact)
    if isinstance(val, datetime.datetime):
        if val.tzinfo is None:
            val = datetime.datetime(val.year, val.month, val.day, val.hour, val.minute, val.second, val.microsecond, tzinfo=datetime.timezone.utc)
        return int(val.timestamp() * 1000)
    elif isinstance(val, datetime.date):
        return int(datetime.datetime(val.year, val.month, val.day, tzinfo=datetime.timezone.utc).timestamp() * 1000)
    elif isinstance(val, (list, tuple)):
        return [_json_helper(i, artifact) for i in val]
    elif isinstance(val, Decimal):
        return float(val)
    else:
        return util.json_friendly(val)[0]
