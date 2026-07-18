from __future__ import annotations
from pydantic import Field
from lumina._pydantic import GQLResult
from .fragments import ArtifactCollectionFragment, PageInfoFragment

class ProjectArtifactCollections(GQLResult):
    project: ProjectArtifactCollectionsProject | None

class ProjectArtifactCollectionsProject(GQLResult):
    artifact_collections: ProjectArtifactCollectionsProjectArtifactCollections | None = Field(alias='artifactCollections')

class ProjectArtifactCollectionsProjectArtifactCollections(GQLResult):
    total_count: int | None = Field(alias='totalCount', default=None)
    page_info: PageInfoFragment = Field(alias='pageInfo')
    edges: list[ProjectArtifactCollectionsProjectArtifactCollectionsEdges]

class ProjectArtifactCollectionsProjectArtifactCollectionsEdges(GQLResult):
    node: ArtifactCollectionFragment | None
ProjectArtifactCollections.model_rebuild()
ProjectArtifactCollectionsProject.model_rebuild()
ProjectArtifactCollectionsProjectArtifactCollections.model_rebuild()
ProjectArtifactCollectionsProjectArtifactCollectionsEdges.model_rebuild()
