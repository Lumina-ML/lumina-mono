from __future__ import annotations
from lumina._pydantic import GQLResult

class AddAliases(GQLResult):
    result: AddAliasesResult | None

class AddAliasesResult(GQLResult):
    success: bool
AddAliases.model_rebuild()
