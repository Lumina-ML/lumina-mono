from __future__ import annotations
from lumina._pydantic import GQLId, GQLResult

class GetDefaultEntity(GQLResult):
    viewer: GetDefaultEntityViewer | None

class GetDefaultEntityViewer(GQLResult):
    id: GQLId
    entity: str | None
GetDefaultEntity.model_rebuild()
