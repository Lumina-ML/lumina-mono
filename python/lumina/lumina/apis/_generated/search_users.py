from __future__ import annotations
from lumina._pydantic import GQLResult
from .fragments import UserFragment

class SearchUsers(GQLResult):
    users: SearchUsersUsers | None

class SearchUsersUsers(GQLResult):
    edges: list[SearchUsersUsersEdges]

class SearchUsersUsersEdges(GQLResult):
    node: UserFragment | None
SearchUsers.model_rebuild()
SearchUsersUsers.model_rebuild()
SearchUsersUsersEdges.model_rebuild()
