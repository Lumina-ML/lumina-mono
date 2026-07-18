import sys
__all__ = ['queue', 'Event']
try:
    import queue
except ImportError:
    import Queue as queue
if sys.version_info < (2, 7):
    from watchdog.utils.event_backport import Event
else:
    from threading import Event