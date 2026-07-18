from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import UserRegistryMemberFragment

class RegistryUserMembers(GQLResult):
    project: RegistryUserMembersProject | None

class RegistryUserMembersProject(GQLResult):
    members: list[UserRegistryMemberFragment]
RegistryUserMembers.model_rebuild()
RegistryUserMembersProject.model_rebuild()
