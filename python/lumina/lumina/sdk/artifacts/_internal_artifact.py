from __future__ import annotations
import re
from base64 import urlsafe_b64encode
from typing import Any, Final
from zlib import crc32
from lumina.sdk.artifacts.artifact import Artifact
PLACEHOLDER: Final[str] = 'PLACEHOLDER'

def sanitize_artifact_name(name: str) -> str:
    """Sanitize the string to satisfy constraints on artifact names."""
    if (sanitized := re.sub('[^a-zA-Z0-9_\\-.]+', '', name)) == name:
        return name
    crc: int = crc32(name.encode('utf-8')) & 4294967295
    crc_bytes = crc.to_bytes(4, byteorder='big')
    suffix = urlsafe_b64encode(crc_bytes).rstrip(b'=').decode('ascii')
    return f'{sanitized}-{suffix}'

class InternalArtifact(Artifact):
    """An Artifact intended for internal use only.

    Includes artifacts of type `job`, `code` (with a `source-` collection name
    prefix), `run_table` (with a `run-` collection name prefix), and any type that starts
    with `wandb-`. Users should not use this class directly.
    """

    def __init__(self, name: str, type: str, description: str | None=None, metadata: dict[str, Any] | None=None, incremental: bool=False, use_as: str | None=None) -> None:
        sanitized_name = sanitize_artifact_name(name)
        super().__init__(sanitized_name, PLACEHOLDER, description, metadata, incremental, use_as)
        self._type = type
