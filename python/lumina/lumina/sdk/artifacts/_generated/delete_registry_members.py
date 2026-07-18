from __future__ import annotations
from lumina._pydantic import GQLResult

class DeleteRegistryMembers(GQLResult):
    result: DeleteRegistryMembersResult | None

class DeleteRegistryMembersResult(GQLResult):
    success: bool
DeleteRegistryMembers.model_rebuild()
