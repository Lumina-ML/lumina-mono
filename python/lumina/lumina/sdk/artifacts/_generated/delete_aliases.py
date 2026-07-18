from __future__ import annotations
from lumina._pydantic import GQLResult

class DeleteAliases(GQLResult):
    result: DeleteAliasesResult | None

class DeleteAliasesResult(GQLResult):
    success: bool
DeleteAliases.model_rebuild()
