from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import RegistryFragment

class FetchRegistry(GQLResult):
    entity: FetchRegistryEntity | None

class FetchRegistryEntity(GQLResult):
    project: RegistryFragment | None
FetchRegistry.model_rebuild()
FetchRegistryEntity.model_rebuild()
