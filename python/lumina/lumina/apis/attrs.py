from __future__ import annotations
from collections.abc import Mapping
from typing import Any
import lumina
from ..sdk.lib import ipython

class Attrs:

    def __init__(self, attrs: Mapping[str, Any]):
        self._attrs = dict(attrs)

    def snake_to_camel(self, string):
        camel = ''.join([i.title() for i in string.split('_')])
        return camel[0].lower() + camel[1:]

    def display(self, height=420, hidden=False) -> bool:
        """Display this object in jupyter."""
        if lumina.run and lumina.run._settings.silent:
            return False
        if not ipython.in_jupyter():
            return False
        html = self.to_html(height, hidden)
        if html is None:
            lumina.termwarn('This object does not support `.display()`')
            return False
        try:
            from IPython import display
        except ImportError:
            lumina.termwarn('.display() only works in jupyter environments')
            return False
        display.display(display.HTML(html))
        return True

    def to_html(self, *args, **kwargs):
        return None

    def __getattr__(self, name):
        key = self.snake_to_camel(name)
        if key == 'user':
            raise AttributeError
        if key in self._attrs:
            return self._attrs[key]
        elif name in self._attrs:
            return self._attrs[name]
        else:
            raise AttributeError(f'{repr(self)!r} object has no attribute {name!r}')
