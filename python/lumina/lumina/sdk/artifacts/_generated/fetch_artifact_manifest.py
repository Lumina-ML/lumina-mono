from __future__ import annotations
from pydantic import Field
from lumina._pydantic import GQLResult
from .fragments import DeferredManifestFragment

class FetchArtifactManifest(GQLResult):
    artifact: FetchArtifactManifestArtifact | None

class FetchArtifactManifestArtifact(GQLResult):
    current_manifest: DeferredManifestFragment | None = Field(alias='currentManifest')
FetchArtifactManifest.model_rebuild()
FetchArtifactManifestArtifact.model_rebuild()
