from __future__ import annotations
from pydantic import Field
from lumina._pydantic import GQLResult
from .fragments import ArtifactMembershipFragment

class LinkArtifact(GQLResult):
    result: LinkArtifactResult | None

class LinkArtifactResult(GQLResult):
    version_index: int | None = Field(alias='versionIndex')
    artifact_membership: ArtifactMembershipFragment | None = Field(alias='artifactMembership', default=None)
LinkArtifact.model_rebuild()
LinkArtifactResult.model_rebuild()
