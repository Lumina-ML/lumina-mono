from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import UserFragment

class GetViewer(GQLResult):
    viewer: UserFragment | None
GetViewer.model_rebuild()
