from __future__ import annotations
import io
import re
import time
from typing import TYPE_CHECKING, Any
import lumina
import lumina.util
from lumina.sdk.lib import telemetry
if TYPE_CHECKING:
    import numpy as np
    from lumina.sdk.internal.tb_watcher import TBHistory
STEPS: dict[str, dict[str, Any]] = {'': {'step': 0}, 'global': {'step': 0, 'last_log': None}}
RATE_LIMIT_SECONDS: float | int | None = None
IGNORE_KINDS = ['graphs']
tensor_util = lumina.util.get_module('tensorboard.util.tensor_util')
pb = lumina.util.get_module('tensorboard.compat.proto.summary_pb2') or lumina.util.get_module('tensorflow.core.framework.summary_pb2')
Summary = pb.Summary if pb else None

def make_ndarray(tensor: Any) -> np.ndarray | None:
    if tensor_util:
        res = tensor_util.make_ndarray(tensor)
        if res.dtype == 'object':
            return None
        else:
            return res
    else:
        lumina.termwarn("Can't convert tensor summary, upgrade tensorboard with `pip install tensorboard --upgrade`")
        return None

def namespaced_tag(tag: str, namespace: str='') -> str:
    if not namespace:
        return tag
    else:
        return namespace + '/' + tag

def history_image_key(key: str, namespace: str='') -> str:
    """Convert invalid filesystem characters to _ for use in History keys.

    Unfortunately this means currently certain image keys will collide silently. We
    implement this mapping up here in the TensorFlow stuff rather than in the History
    stuff so that we don't have to store a mapping anywhere from the original keys to
    the safe ones.
    """
    return namespaced_tag(re.sub('[/\\\\]', '_', key), namespace)

def tf_summary_to_dict(tf_summary_str_or_pb: Any, namespace: str='') -> dict[str, Any] | None:
    """Convert a Tensorboard Summary to a dictionary.

    Accepts a tensorflow.summary.Summary, one encoded as a string,
    or a list of such encoded as strings.
    """
    values = {}
    if hasattr(tf_summary_str_or_pb, 'summary'):
        summary_pb = tf_summary_str_or_pb.summary
        values[namespaced_tag('global_step', namespace)] = tf_summary_str_or_pb.step
        values['_timestamp'] = tf_summary_str_or_pb.wall_time
    elif isinstance(tf_summary_str_or_pb, (str, bytes, bytearray)):
        summary_pb = Summary()
        summary_pb.ParseFromString(tf_summary_str_or_pb)
    elif hasattr(tf_summary_str_or_pb, '__iter__'):
        summary_pb = [Summary() for _ in range(len(tf_summary_str_or_pb))]
        for i, summary in enumerate(tf_summary_str_or_pb):
            summary_pb[i].ParseFromString(summary)
            if i > 0:
                summary_pb[0].MergeFrom(summary_pb[i])
        summary_pb = summary_pb[0]
    else:
        summary_pb = tf_summary_str_or_pb
    if not hasattr(summary_pb, 'value') or len(summary_pb.value) == 0:
        return None

    def encode_images(_img_strs: list[bytes], _value: Any) -> None:
        try:
            from PIL import Image
        except ImportError:
            lumina.termwarn('Install pillow if you are logging images with Tensorboard. To install, run `pip install pillow`.', repeat=False)
            return None
        if len(_img_strs) == 0:
            return None
        images: list[lumina.Video | lumina.Image] = []
        for _img_str in _img_strs:
            if _img_str.startswith(b'GIF'):
                images.append(lumina.Video(io.BytesIO(_img_str), format='gif'))
            else:
                images.append(lumina.Image(Image.open(io.BytesIO(_img_str))))
        tag_idx = _value.tag.rsplit('/', 1)
        if len(tag_idx) > 1 and tag_idx[1].isdigit():
            tag, idx = tag_idx
            values.setdefault(history_image_key(tag, namespace), []).extend(images)
        else:
            values[history_image_key(_value.tag, namespace)] = images
        return None
    for value in summary_pb.value:
        kind = value.WhichOneof('value')
        if kind in IGNORE_KINDS:
            continue
        if kind == 'simple_value':
            values[namespaced_tag(value.tag, namespace)] = value.simple_value
        elif kind == 'tensor':
            plugin_name = value.metadata.plugin_data.plugin_name
            if plugin_name == 'scalars' or plugin_name == '':
                values[namespaced_tag(value.tag, namespace)] = make_ndarray(value.tensor)
            elif plugin_name == 'images':
                img_strs = value.tensor.string_val[2:]
                encode_images(img_strs, value)
            elif plugin_name == 'histograms':
                ndarray = make_ndarray(value.tensor)
                if ndarray is None:
                    continue
                shape = ndarray.shape
                counts = []
                bins = []
                if shape[0] > 1:
                    bins.append(ndarray[0][0])
                    for v in ndarray:
                        counts.append(v[2])
                        bins.append(v[1])
                elif shape[0] == 1:
                    counts = [ndarray[0][2]]
                    bins = ndarray[0][:2]
                if len(counts) > 0:
                    try:
                        values[namespaced_tag(value.tag, namespace)] = lumina.Histogram(np_histogram=(counts, bins))
                    except ValueError:
                        lumina.termwarn(f'Not logging key "{namespaced_tag(value.tag, namespace)}". Histograms must have fewer than {lumina.Histogram.MAX_LENGTH} bins', repeat=False)
            elif plugin_name == 'pr_curves':
                pr_curve_data = make_ndarray(value.tensor)
                if pr_curve_data is None:
                    continue
                precision = pr_curve_data[-2, :].tolist()
                recall = pr_curve_data[-1, :].tolist()
                data = []
                for i in range(min(len(precision), len(recall))):
                    if precision[i] != 0 or recall[i] != 0:
                        data.append((recall[i], precision[i]))
                data = sorted(data, key=lambda x: (x[0], -x[1]))
                data_table = lumina.Table(data=data, columns=['recall', 'precision'])
                name = namespaced_tag(value.tag, namespace)
                values[name] = lumina.plot_table('wandb/line/v0', data_table, {'x': 'recall', 'y': 'precision'}, {'title': f'{name} Precision v. Recall'})
        elif kind == 'image':
            img_str = value.image.encoded_image_string
            encode_images([img_str], value)
        elif kind == 'histo':
            tag = namespaced_tag(value.tag, namespace)
            if len(value.histo.bucket_limit) >= 3:
                first = value.histo.bucket_limit[0] + value.histo.bucket_limit[0] - value.histo.bucket_limit[1]
                last = value.histo.bucket_limit[-2] + value.histo.bucket_limit[-2] - value.histo.bucket_limit[-3]
                np_histogram = (list(value.histo.bucket), [first] + value.histo.bucket_limit[:-1] + [last])
                try:
                    values[tag] = lumina.Histogram(np_histogram=np_histogram)
                except ValueError:
                    lumina.termwarn(f'Not logging key {tag!r}. Histograms must have fewer than {lumina.Histogram.MAX_LENGTH} bins', repeat=False)
            else:
                lumina.termwarn(f'Not logging key {tag!r}. Found a histogram with only 2 bins.', repeat=False)
    return values

def reset_state() -> None:
    """Internal method for resetting state, called by wandb.finish()."""
    global STEPS
    STEPS = {'': {'step': 0}, 'global': {'step': 0, 'last_log': None}}

def _log(tf_summary_str_or_pb: Any, history: TBHistory | None=None, step: int=0, namespace: str='', **kwargs: Any) -> None:
    """Logs a tfsummary to wandb.

    Can accept a tf summary string or parsed event.  Will use wandb.run.history unless a
    history object is passed.  Can optionally namespace events.  Results are committed
    when step increases for this namespace.

    NOTE: This assumes that events being passed in are in chronological order
    """
    global STEPS
    global RATE_LIMIT_SECONDS
    last_step = STEPS.get(namespace, {'step': 0})
    commit = False
    if last_step['step'] < step:
        commit = True
    log_dict = tf_summary_to_dict(tf_summary_str_or_pb, namespace)
    if log_dict is None:
        return
    timestamp = log_dict.get('_timestamp', time.time())
    if STEPS['global']['last_log'] is None:
        STEPS['global']['last_log'] = timestamp
    if commit and step == STEPS['global']['step']:
        commit = False
    if step > STEPS['global']['step']:
        STEPS['global']['step'] = step
    if namespace != '':
        log_dict['global_step'] = STEPS['global']['step']
    STEPS[namespace] = {'step': step}
    if commit:
        if RATE_LIMIT_SECONDS is None or timestamp - STEPS['global']['last_log'] >= RATE_LIMIT_SECONDS:
            if history is None:
                if lumina.run is not None:
                    lumina.run._log({})
            else:
                history.add({})
        STEPS['global']['last_log'] = timestamp
    if history is None:
        if lumina.run is not None:
            lumina.run._log(log_dict, commit=False)
    else:
        history._row_update(log_dict)

def log(tf_summary_str_or_pb: Any, step: int=0, namespace: str='') -> None:
    if lumina.run is None:
        raise lumina.Error('You must call `wandb.init()` before calling `wandb.tensorflow.log`')
    with telemetry.context() as tel:
        tel.feature.tensorboard_log = True
    _log(tf_summary_str_or_pb, namespace=namespace, step=step)
