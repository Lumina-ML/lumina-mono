from __future__ import annotations
from lumina._pydantic import GQLResult

class UpdateUserRegistryRole(GQLResult):
    result: UpdateUserRegistryRoleResult | None

class UpdateUserRegistryRoleResult(GQLResult):
    success: bool
UpdateUserRegistryRole.model_rebuild()
