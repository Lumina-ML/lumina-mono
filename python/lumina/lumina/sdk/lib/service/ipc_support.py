"""Constants determining what IPC methods are supported."""
import socket
SUPPORTS_UNIX = hasattr(socket, 'AF_UNIX')
'Whether Unix sockets are supported.\n\nAF_UNIX is not supported on Windows:\nhttps://github.com/python/cpython/issues/77589\n\nWindows has supported Unix sockets since ~2017, but support in Python is\nmissing as of 2025.\n'
