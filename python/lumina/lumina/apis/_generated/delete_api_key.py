from __future__ import annotations
from lumina._pydantic import GQLResult

class DeleteApiKey(GQLResult):
    result: DeleteApiKeyResult | None

class DeleteApiKeyResult(GQLResult):
    success: bool | None
DeleteApiKey.model_rebuild()
