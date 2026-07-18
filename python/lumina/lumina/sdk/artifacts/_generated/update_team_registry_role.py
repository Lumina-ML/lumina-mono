from __future__ import annotations
from lumina._pydantic import GQLResult

class UpdateTeamRegistryRole(GQLResult):
    result: UpdateTeamRegistryRoleResult | None

class UpdateTeamRegistryRoleResult(GQLResult):
    success: bool
UpdateTeamRegistryRole.model_rebuild()
