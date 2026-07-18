from __future__ import annotations
from pydantic import Field
from lumina._pydantic import GQLResult

class IsProjectReadOnly(GQLResult):
    project: IsProjectReadOnlyProject | None

class IsProjectReadOnlyProject(GQLResult):
    read_only: bool | None = Field(alias='readOnly')
IsProjectReadOnly.model_rebuild()
