"""Recent Artifact storage.

Artifacts are registered in the cache to ensure they won't be immediately garbage
collected and can be retrieved by their ID.
"""
from __future__ import annotations
from typing import TYPE_CHECKING
from lumina.sdk.lib.capped_dict import CappedDict
if TYPE_CHECKING:
    from lumina.sdk.artifacts.artifact import Artifact
artifact_instance_cache: dict[str, Artifact] = CappedDict(100)
artifact_instance_cache_by_client_id: dict[str, Artifact] = CappedDict(100)
