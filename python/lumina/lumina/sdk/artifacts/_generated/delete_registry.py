from __future__ import annotations
from pydantic import Field
from lumina._pydantic import GQLResult

class DeleteRegistry(GQLResult):
    delete_model: DeleteRegistryDeleteModel | None = Field(alias='deleteModel')

class DeleteRegistryDeleteModel(GQLResult):
    success: bool | None
DeleteRegistry.model_rebuild()
