from __future__ import annotations
import os
import platform
from functools import wraps
from pathlib import PurePath, PurePosixPath
from typing import Any, TypeAlias, Union
StrPath: TypeAlias = Union[str, 'os.PathLike[str]']
FilePathStr: TypeAlias = str
URIStr: TypeAlias = str

class LogicalPath(str):
    """A string that represents a path relative to an artifact or run.

    The format of the string is always as a POSIX path, e.g. "foo/bar.txt".

    A neat trick is that you can use this class as if it were a PurePosixPath. E.g.:
    ```
    >>> path = LogicalPath("foo/bar.txt")
    >>> path.parts
    ('foo', 'bar.txt')
    >>> path.parent / "baz.txt"
    'foo/baz.txt'
    >>> type(path.relative_to("foo"))
    LogicalPath
    ```
    """

    def __new__(cls, path: StrPath) -> LogicalPath:
        if isinstance(path, LogicalPath):
            return super().__new__(cls, path)
        if hasattr(path, 'as_posix'):
            path = PurePosixPath(path.as_posix())
            return super().__new__(cls, str(path))
        if hasattr(path, '__fspath__'):
            path = path.__fspath__()
        if isinstance(path, bytes):
            path = os.fsdecode(path)
        if platform.system() == 'Windows':
            path = path.replace('\\', '/')
        path = PurePath(path).as_posix()
        return super().__new__(cls, str(PurePosixPath(path)))

    def to_path(self) -> PurePosixPath:
        """Convert this path to a PurePosixPath."""
        return PurePosixPath(self)

    def __getattr__(self, name: str) -> Any:
        """Act like a subclass of PurePosixPath for all methods not defined on str."""
        try:
            attr = getattr(self.to_path(), name)
        except AttributeError:
            classname = type(self).__qualname__
            raise AttributeError(f'{classname!r} has no attribute {name!r}') from None
        if isinstance(attr, PurePosixPath):
            return LogicalPath(attr)
        if callable((fn := attr)):

            @wraps(fn)
            def wrapper(*args: Any, **kwargs: Any) -> Any:
                if isinstance((res := fn(*args, **kwargs)), PurePosixPath):
                    return LogicalPath(res)
                return res
            return wrapper
        return attr

    def __truediv__(self, other: StrPath) -> LogicalPath:
        """Act like a PurePosixPath for the / operator, but return a LogicalPath."""
        return LogicalPath(self.to_path() / LogicalPath(other))
