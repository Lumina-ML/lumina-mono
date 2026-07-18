from __future__ import annotations
from pydantic import Field
from lumina._pydantic import GQLResult
from .fragments import ArtifactCollectionFragment

class UpdateArtifactSequenceType(GQLResult):
    result: UpdateArtifactSequenceTypeResult | None

class UpdateArtifactSequenceTypeResult(GQLResult):
    artifact_collection: ArtifactCollectionFragment | None = Field(alias='artifactCollection')
UpdateArtifactSequenceType.model_rebuild()
UpdateArtifactSequenceTypeResult.model_rebuild()
