from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import UserInfoFragment

class CreateUserFromAdmin(GQLResult):
    result: CreateUserFromAdminResult | None

class CreateUserFromAdminResult(GQLResult):
    user: UserInfoFragment | None
CreateUserFromAdmin.model_rebuild()
CreateUserFromAdminResult.model_rebuild()
