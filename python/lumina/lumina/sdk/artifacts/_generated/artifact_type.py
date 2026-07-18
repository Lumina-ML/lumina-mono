from __future__ import annotations
from pydantic import Field
from lumina._pydantic import GQLResult

class ArtifactType(GQLResult):
    project: ArtifactTypeProject | None

class ArtifactTypeProject(GQLResult):
    artifact: ArtifactTypeProjectArtifact | None

class ArtifactTypeProjectArtifact(GQLResult):
    artifact_type: ArtifactTypeProjectArtifactArtifactType = Field(alias='artifactType')

class ArtifactTypeProjectArtifactArtifactType(GQLResult):
    name: str
ArtifactType.model_rebuild()
ArtifactTypeProject.model_rebuild()
ArtifactTypeProjectArtifact.model_rebuild()
