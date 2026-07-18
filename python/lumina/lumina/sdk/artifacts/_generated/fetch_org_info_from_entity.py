from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import OrgInfoFragment

class FetchOrgInfoFromEntity(GQLResult):
    entity: FetchOrgInfoFromEntityEntity | None

class FetchOrgInfoFromEntityEntity(GQLResult):
    organization: OrgInfoFragment | None
    user: FetchOrgInfoFromEntityEntityUser | None

class FetchOrgInfoFromEntityEntityUser(GQLResult):
    organizations: list[OrgInfoFragment]
FetchOrgInfoFromEntity.model_rebuild()
FetchOrgInfoFromEntityEntity.model_rebuild()
FetchOrgInfoFromEntityEntityUser.model_rebuild()
