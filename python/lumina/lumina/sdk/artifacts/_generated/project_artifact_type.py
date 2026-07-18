from __future__ import annotations
from pydantic import Field
from lumina._pydantic import GQLResult
from .fragments import ArtifactTypeFragment

class ProjectArtifactType(GQLResult):
    project: ProjectArtifactTypeProject | None

class ProjectArtifactTypeProject(GQLResult):
    artifact_type: ArtifactTypeFragment | None = Field(alias='artifactType')
ProjectArtifactType.model_rebuild()
ProjectArtifactTypeProject.model_rebuild()
