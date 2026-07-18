from __future__ import annotations
import codecs
import json
import os
import pathlib
from typing import TYPE_CHECKING
from lumina import util
from lumina._strutils import nameof
from lumina.sdk.lib import runid
from . import _dtypes
from ._private import MEDIA_TMP
from .base_types.media import Media
if TYPE_CHECKING:
    from bokeh import document, model

def _doc_to_json(doc):
    try:
        return doc.to_json(deferred=False)
    except TypeError:
        return doc.to_json()

class Bokeh(Media):
    """Wandb class for Bokeh plots.

    Args:
        val: Bokeh plot
    """
    _log_type = 'bokeh-file'

    def __init__(self, data_or_path: str | pathlib.Path | document.Document | model.Model):
        super().__init__()
        bokeh = util.get_module('bokeh', required=f'{nameof(Bokeh)!r} requires the bokeh package.  Please install it with `pip install bokeh`.')
        if isinstance(data_or_path, (str, pathlib.Path)) and os.path.exists(data_or_path):
            data_or_path = str(data_or_path)
            with open(data_or_path) as file:
                b_json = json.load(file)
            self.b_obj = bokeh.document.Document.from_json(b_json)
            self._set_file(data_or_path, is_tmp=False, extension='.bokeh.json')
        elif isinstance(data_or_path, bokeh.model.Model):
            _data = bokeh.document.Document()
            _data.add_root(data_or_path)
            self.b_obj = bokeh.document.Document.from_json(_doc_to_json(_data))
            b_json = _doc_to_json(self.b_obj)
            roots = b_json.get('roots')
            if isinstance(roots, dict) and 'references' in roots:
                roots['references'].sort(key=lambda x: x['id'])
            tmp_path = os.path.join(MEDIA_TMP.name, runid.generate_id() + '.bokeh.json')
            with codecs.open(tmp_path, 'w', encoding='utf-8') as fp:
                util.json_dump_safer(b_json, fp)
            self._set_file(tmp_path, is_tmp=True, extension='.bokeh.json')
        elif not isinstance(data_or_path, bokeh.document.Document):
            raise TypeError('Bokeh constructor accepts Bokeh document/model or path to Bokeh json file')

    def get_media_subdir(self):
        return os.path.join('media', 'bokeh')

    def to_json(self, run):
        json_dict = super().to_json(run)
        json_dict['_type'] = self._log_type
        return json_dict

    @classmethod
    def from_json(cls, json_obj, source_artifact):
        return cls(source_artifact.get_entry(json_obj['path']).download())

class _BokehFileType(_dtypes.Type):
    name = 'bokeh-file'
    types = [Bokeh]
_dtypes.TypeRegistry.add(_BokehFileType)
