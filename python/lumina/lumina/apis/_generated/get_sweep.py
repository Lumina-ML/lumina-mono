from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import SweepFragment

class GetSweep(GQLResult):
    project: GetSweepProject | None

class GetSweepProject(GQLResult):
    sweep: SweepFragment | None
GetSweep.model_rebuild()
GetSweepProject.model_rebuild()
