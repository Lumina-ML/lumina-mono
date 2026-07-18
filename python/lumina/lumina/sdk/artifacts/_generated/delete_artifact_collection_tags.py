from __future__ import annotations
from lumina._pydantic import GQLResult

class DeleteArtifactCollectionTags(GQLResult):
    result: DeleteArtifactCollectionTagsResult | None

class DeleteArtifactCollectionTagsResult(GQLResult):
    success: bool
DeleteArtifactCollectionTags.model_rebuild()
