from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import ArtifactFragment

class ArtifactByID(GQLResult):
    artifact: ArtifactFragment | None
ArtifactByID.model_rebuild()
