"""Storage policy factory.

Step 3.5 — the wandb-cloud `WandbStoragePolicy` (which routed files
through `internal_api.Api` GraphQL + `FilePusher` S3 multipart) was
deleted. Artifact storage on the Lumina backend goes through
`LuminaClient.{create_artifact, create_artifact_version,
add_artifact_file, finalize_artifact_version}` directly — there is
no StoragePolicy abstraction.

`make_storage_policy` is kept as a backward-compatible entry point
that documents the deprecation.
"""
from __future__ import annotations
from typing import TYPE_CHECKING

from ._models.storage import StoragePolicyConfig

if TYPE_CHECKING:
    from .storage_policy import StoragePolicy


def make_storage_policy(region: str | None = None) -> "StoragePolicy":
    """Returns a default `StoragePolicy`.

    .. deprecated::
        The wandb-cloud `StoragePolicy` abstraction is gone. Lumina
        artifact save goes through `LuminaClient` directly
        (see `LuminaArtifact.save()`). This function is preserved
        only so `from lumina.sdk.artifacts._factories import make_storage_policy`
        keeps resolving; callers that actually invoke it will get an
        informative error.
    """
    raise NotImplementedError(
        "make_storage_policy() is removed under the Lumina backend. "
        "Use LuminaArtifact.save() (lumina.backend.artifact) which "
        "calls LuminaClient directly — no StoragePolicy needed.",
    )
