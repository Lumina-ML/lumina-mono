from __future__ import annotations
import netrc
import os
import pathlib
import platform
import shlex
from urllib.parse import urlsplit
from lumina.errors import term
from .auth import AuthApiKey, AuthWithSource
from .host_url import HostUrl

class WriteNetrcError(Exception):
    """Could not write to the netrc file."""

def read_netrc_auth(*, host: str | HostUrl) -> str | None:
    """Read a W&B API key from the .netrc file.

    Args:
        host: The W&B server URL.

    Returns:
        An API key for the host, or None if there's no .netrc file
        or if it doesn't contain credentials for the specified host.

    Raises:
        AuthenticationError: If an API key is found but is not in
            a valid format.
    """
    if not isinstance(host, HostUrl):
        host = HostUrl(host)
    if not (auth := read_netrc_auth_with_source(host=host)):
        return None
    assert isinstance(auth.auth, AuthApiKey)
    return auth.auth.api_key

def read_netrc_auth_with_source(*, host: HostUrl) -> AuthWithSource | None:
    """Read a W&B API key from the .netrc file.

    Args:
        host: The W&B server URL.

    Returns:
        An API key for the host, or None if there's no .netrc file
        or it doesn't contain credentials for the specified host.
        Also returns the file in which the API key was found.

    Raises:
        AuthenticationError: If an API key is found but is not in
            a valid format.
    """
    path = _get_netrc_file_path()
    try:
        netrc_file = netrc.netrc(path)
    except FileNotFoundError:
        return None
    except (netrc.NetrcParseError, OSError) as e:
        if isinstance(e, netrc.NetrcParseError) and e.lineno is not None:
            term.termwarn(f'Failed to read netrc file at {path},' + f' error on line {e.lineno}: {e.msg}')
        else:
            term.termwarn(f'Failed to read netrc file at {path}: {e}')
        return None
    if not (netloc := urlsplit(host.url).netloc):
        return None
    if not (creds := netrc_file.authenticators(netloc)):
        return None
    _, _, password = creds
    if not password:
        term.termwarn(f'Found entry for machine {netloc!r} with no API key at {path}')
        return None
    return AuthWithSource(auth=AuthApiKey(host=host, api_key=password), source=str(path))

def write_netrc_auth(*, host: str, api_key: str) -> None:
    """Store an API key in the .netrc file.

    Args:
        host: The W&B server URL.
        api_key: A valid API key to write.

    Raises:
        WriteNetrcError: If there's a problem writing to the .netrc file.
    """
    if not (netloc := urlsplit(host).netloc):
        raise ValueError(f'Invalid host URL: {host!r}')
    _update_netrc(_get_netrc_file_path(), machine=netloc, password=api_key)

def _update_netrc(path: pathlib.Path, *, machine: str, password: str) -> None:
    machine = shlex.quote(machine)
    password = shlex.quote(password)
    machine_line = f'machine {machine}'
    orig_lines = []
    try:
        orig_lines = path.read_text().splitlines()
    except FileNotFoundError:
        term.termlog('No netrc file found, creating one.')
        path.touch(mode=384)
    except OSError as e:
        raise WriteNetrcError(f'Unable to read {path}: {e}') from e
    new_lines: list[str] = []
    skip = 0
    for line in orig_lines:
        if machine_line in line:
            skip = 2
        elif skip > 0:
            skip -= 1
        else:
            new_lines.append(line)
    new_lines.extend([f'machine {machine}', '  login user', f'  password {password}', ''])
    term.termlog(f'Appending key for {machine} to your netrc file: {path}')
    try:
        _write_text(path, '\n'.join(new_lines))
    except OSError as e:
        raise WriteNetrcError(f'Unable to write {path}: {e}') from e

def _write_text(path: pathlib.Path, text: str) -> None:
    """Call pathlib.Path.write_text().

    Patched in tests.
    """
    path.write_text(text)

def _get_netrc_file_path() -> pathlib.Path:
    """Returns the path to the .netrc file.

    The file at the path may or may not exist.
    """
    if (netrc_file := os.environ.get('NETRC')):
        return pathlib.Path(netrc_file).expanduser()
    unix_netrc = pathlib.Path('~/.netrc').expanduser()
    if unix_netrc.exists():
        return unix_netrc
    windows_netrc = pathlib.Path('~/_netrc').expanduser()
    if windows_netrc.exists():
        return windows_netrc
    if platform.system() != 'Windows':
        return unix_netrc
    else:
        return windows_netrc
