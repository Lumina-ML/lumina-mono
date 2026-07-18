from __future__ import annotations
from lumina._pydantic import GQLResult

class DeleteInvite(GQLResult):
    result: DeleteInviteResult | None

class DeleteInviteResult(GQLResult):
    success: bool | None
DeleteInvite.model_rebuild()
