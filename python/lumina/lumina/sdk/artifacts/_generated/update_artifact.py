from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import ArtifactFragment

class UpdateArtifact(GQLResult):
    result: UpdateArtifactResult | None

class UpdateArtifactResult(GQLResult):
    artifact: ArtifactFragment
UpdateArtifact.model_rebuild()
UpdateArtifactResult.model_rebuild()
