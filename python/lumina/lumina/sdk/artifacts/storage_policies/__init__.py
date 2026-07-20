"""Storage policy registry.

The wandb-cloud `WandbStoragePolicy` was deleted in step 3.5 (it
pushed files through `internal_api.Api` GraphQL + `FilePusher` S3
multipart, both gone). Lumina storage policies now live in
`lumina.sdk.artifacts.storage_policies.s3` (and future Lumina-native
ones will register here).
"""
from lumina.sdk.artifacts.storage_policies.register import WANDB_STORAGE_POLICY

__all__ = ["WANDB_STORAGE_POLICY"]
