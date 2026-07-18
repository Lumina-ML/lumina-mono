from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import TagFragment

class AddArtifactCollectionTags(GQLResult):
    result: AddArtifactCollectionTagsResult | None

class AddArtifactCollectionTagsResult(GQLResult):
    tags: list[TagFragment]
AddArtifactCollectionTags.model_rebuild()
AddArtifactCollectionTagsResult.model_rebuild()
