"""Stub for the wandb-cloud GraphQL `_generated` package.

Step 3.6 — the real GraphQL queries, mutations, and pydantic result
types previously auto-generated here (from the wandb GraphQL
schema) were deleted along with the wandb-cloud reporting stack.

The Lumina backend serves artifact / registry / automation
operations through `LuminaClient` REST instead, so this module no
longer needs the GraphQL operations. However, several existing
importers do `from ._generated import SOME_QUERY_GQL, SomePydanticModel`.
Rather than touch every importer, this stub uses PEP 562's
module-level `__getattr__` to make *any* attribute lookup return
`Any` — so `from ._generated import XYZ` resolves at import time,
and the code that actually uses the symbol still fails fast at
the underlying `ServiceApi.execute_graphql(...)` call site (which
raises `NotImplementedError` under the Lumina backend).
"""
from __future__ import annotations
from typing import Any


def __getattr__(name: str) -> Any:
    """Module-level PEP 562 getattr: return `Any` for any name."""
    return Any


def __dir__() -> list[str]:
    return []
