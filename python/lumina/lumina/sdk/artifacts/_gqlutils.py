"""Stub for the wandb-cloud GraphQL utility helpers.

Step 3.6 — the original `_gqlutils.py` queried wandb-cloud for org
entity names + server feature flags via GraphQL. Under the Lumina
backend these are local concerns:

- `resolve_org_entity_name` / `resolve_org_name` return the input
  entity unchanged (Lumina has no separate "org" / "entity"
  distinction at this layer).
- `server_supports` returns `False` for all features (Lumina doesn't
  expose a wandb-style feature-flag endpoint).
- `is_project_read_only` returns `None` (caller treats as "unknown").

Public-API callers continue to receive the same return types, so
existing code paths keep type-checking; calls that depended on the
GraphQL round-trip simply get the safe defaults.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class OrgInfo:
    org_name: str
    entity_name: str

    def __contains__(self, other: str) -> bool:
        return other in {self.org_name, self.entity_name}


def org_info_from_entity(service_api: Any, entity: str) -> Any:
    """No-op under the Lumina backend."""
    return None


def server_supports(service_api: Any, feature: str | int) -> bool:
    """Returns False — Lumina server has no feature-flag endpoint."""
    return False


def _resolve_org_info(
    service_api: Any,
    non_org_entity: str | None,
    org_or_entity: str | None = None,
) -> OrgInfo:
    """Return the input entity as the org entity name (no org/entity split)."""
    if not non_org_entity:
        raise ValueError("Entity name is required to resolve org entity name.")
    return OrgInfo(org_name=non_org_entity, entity_name=non_org_entity)


def resolve_org_entity_name(
    service_api: Any,
    non_org_entity: str | None,
    org_or_entity: str | None = None,
) -> str:
    return _resolve_org_info(service_api, non_org_entity, org_or_entity).entity_name


def resolve_org_name(
    service_api: Any,
    non_org_entity: str | None,
    org_or_entity: str | None = None,
) -> str:
    return _resolve_org_info(service_api, non_org_entity, org_or_entity).org_name


def is_project_read_only(
    service_api: Any,
    entity: str,
    project: str,
) -> bool | None:
    """Returns None — caller treats as "unknown" / not read-only."""
    return None
