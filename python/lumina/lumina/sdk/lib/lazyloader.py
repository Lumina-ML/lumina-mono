"""module lazyloader."""
import importlib
import sys
import types

class LazyLoader(types.ModuleType):
    """Lazily import a module, mainly to avoid pulling in large dependencies.

    We use this for tensorflow and other optional libraries primarily at the
    top module level.
    """

    def __init__(self, local_name, parent_module_globals, name, warning=None):
        self._local_name = local_name
        self._parent_module_globals = parent_module_globals
        self._warning = warning
        super().__init__(str(name))

    def _load(self):
        """Load the module and insert it into the parent's globals."""
        module = importlib.import_module(self.__name__)
        self._parent_module_globals[self._local_name] = module
        sys.modules[self._local_name] = module
        if self._warning:
            print(self._warning)
            self._warning = None
        self.__dict__.update(module.__dict__)
        return module

    def __getattr__(self, item):
        module = self._load()
        return getattr(module, item)

    def __dir__(self):
        module = self._load()
        return dir(module)
