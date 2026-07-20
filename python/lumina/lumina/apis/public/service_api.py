"""Backward-compat shim for the wandb-cloud `ServiceApi` GraphQL transport.

Step 3.5 — the real implementation was deleted (replaced by
`LuminaClient` REST). This module is kept so the 20+ files that
import `from lumina.apis.public.service_api import ServiceApi`
keep resolving. The `ServiceApi` class itself lives in
`lumina.apis.public.api` so we don't duplicate the stub.
"""
from __future__ import annotations
from lumina.apis.public.api import ServiceApi

__all__ = ["ServiceApi"]
