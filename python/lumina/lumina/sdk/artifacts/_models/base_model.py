from __future__ import annotations
from abc import ABC
from pydantic import ConfigDict
from lumina._pydantic import JsonableModel

class ArtifactsBase(JsonableModel, ABC):
    model_config = ConfigDict(arbitrary_types_allowed=True, revalidate_instances='subclass-instances')
