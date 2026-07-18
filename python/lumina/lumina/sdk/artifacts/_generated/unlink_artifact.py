from __future__ import annotations
from lumina._pydantic import GQLResult

class UnlinkArtifact(GQLResult):
    result: UnlinkArtifactResult | None

class UnlinkArtifactResult(GQLResult):
    success: bool
UnlinkArtifact.model_rebuild()
