"""Stub for the wandb-cloud GraphQL `_generated` package.

Step 3.6 — see `lumina.sdk.artifacts._generated` for the full
explanation. Module-level `__getattr__` makes every
`from ._generated import XYZ` resolve to `Any` so importers don't
need changes; actual GraphQL calls hit `ServiceApi.execute_graphql`
which raises `NotImplementedError` under the Lumina backend.
"""
from __future__ import annotations
from typing import Any


def __getattr__(name: str) -> Any:
    return Any


def __dir__() -> list[str]:
    return []
