from __future__ import annotations
from pydantic import Field
from lumina._pydantic import GQLResult
from .fragments import RegistryFragment

class UpsertRegistry(GQLResult):
    upsert_model: UpsertRegistryUpsertModel | None = Field(alias='upsertModel')

class UpsertRegistryUpsertModel(GQLResult):
    inserted: bool | None
    project: RegistryFragment | None
UpsertRegistry.model_rebuild()
UpsertRegistryUpsertModel.model_rebuild()
