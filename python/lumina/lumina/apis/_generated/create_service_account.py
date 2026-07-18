from __future__ import annotations
from lumina._pydantic import GQLId, GQLResult

class CreateServiceAccount(GQLResult):
    result: CreateServiceAccountResult | None

class CreateServiceAccountResult(GQLResult):
    user: CreateServiceAccountResultUser | None

class CreateServiceAccountResultUser(GQLResult):
    id: GQLId
CreateServiceAccount.model_rebuild()
CreateServiceAccountResult.model_rebuild()
