from __future__ import annotations
from pydantic import Field
from lumina._pydantic import GQLResult

class ServerFeaturesQuery(GQLResult):
    server_info: ServerFeaturesQueryServerInfo | None = Field(alias='serverInfo')

class ServerFeaturesQueryServerInfo(GQLResult):
    features: list[ServerFeaturesQueryServerInfoFeatures | None]

class ServerFeaturesQueryServerInfoFeatures(GQLResult):
    name: str
    is_enabled: bool = Field(alias='isEnabled')
ServerFeaturesQuery.model_rebuild()
ServerFeaturesQueryServerInfo.model_rebuild()
