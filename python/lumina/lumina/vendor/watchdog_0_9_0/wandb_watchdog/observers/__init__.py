"""
:module: watchdog.observers
:synopsis: Observer that picks a native implementation if available.
:author: yesudeep@google.com (Yesudeep Mangalapilly)


Classes
=======
.. autoclass:: Observer
   :members:
   :show-inheritance:
   :inherited-members:
   
Observer thread that schedules watching directories and dispatches
calls to event handlers.

You can also import platform specific classes directly and use it instead
of :class:`Observer`.  Here is a list of implemented observer classes.:

============== ================================ ==============================
Class          Platforms                        Note
============== ================================ ==============================
|Inotify|      Linux 2.6.13+                    ``inotify(7)`` based observer
|FSEvents|     Mac OS X                         FSEvents based observer
|Kqueue|       Mac OS X and BSD with kqueue(2)  ``kqueue(2)`` based observer
|WinApi|       MS Windows                       Windows API-based observer
|Polling|      Any                              fallback implementation
============== ================================ ==============================

.. |Inotify|     replace:: :class:`.inotify.InotifyObserver`
.. |FSEvents|    replace:: :class:`.fsevents.FSEventsObserver`
.. |Kqueue|      replace:: :class:`.kqueue.KqueueObserver`
.. |WinApi|      replace:: :class:`.read_directory_changes.WindowsApiObserver`
.. |WinApiAsync| replace:: :class:`.read_directory_changes_async.WindowsApiAsyncObserver`
.. |Polling|     replace:: :class:`.polling.PollingObserver`

"""
import warnings
from wandb_watchdog.utils import platform
from wandb_watchdog.utils import UnsupportedLibc
if platform.is_linux():
    try:
        from .inotify import InotifyObserver as Observer
    except UnsupportedLibc:
        from .polling import PollingObserver as Observer
elif platform.is_darwin():
    try:
        from .fsevents import FSEventsObserver as Observer
    except:
        try:
            from .kqueue import KqueueObserver as Observer
        except:
            from .polling import PollingObserver as Observer
elif platform.is_bsd():
    from .kqueue import KqueueObserver as Observer
elif platform.is_windows():
    try:
        from .read_directory_changes import WindowsApiObserver as Observer
    except:
        from .polling import PollingObserver as Observer
        warnings.warn('Failed to import read_directory_changes. Fall back to polling.')
else:
    from .polling import PollingObserver as Observer
__all__ = ['Observer']
