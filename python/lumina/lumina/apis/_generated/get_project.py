from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import ProjectFragment

class GetProject(GQLResult):
    project: ProjectFragment | None
GetProject.model_rebuild()
