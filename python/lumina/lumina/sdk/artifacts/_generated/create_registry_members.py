from __future__ import annotations
from lumina._pydantic import GQLResult

class CreateRegistryMembers(GQLResult):
    result: CreateRegistryMembersResult | None

class CreateRegistryMembersResult(GQLResult):
    success: bool
CreateRegistryMembers.model_rebuild()
