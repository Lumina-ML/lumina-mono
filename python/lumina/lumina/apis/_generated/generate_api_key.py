from __future__ import annotations
from pydantic import Field
from lumina._pydantic import GQLResult
from .fragments import ApiKeyFragment

class GenerateApiKey(GQLResult):
    result: GenerateApiKeyResult | None

class GenerateApiKeyResult(GQLResult):
    api_key: ApiKeyFragment | None = Field(alias='apiKey')
GenerateApiKey.model_rebuild()
GenerateApiKeyResult.model_rebuild()
