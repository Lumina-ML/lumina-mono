"""Environment abstraction for Launch.

Encapsulates everything that's true about the execution environment
(e.g. ``region``, default registry, default builder). A ``LocalEnvironment``
is a sensible default for laptop agents; production deployments will
subclass with cloud-specific helpers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class EnvironmentSpec:
    region: str = "local"
    default_registry: str = "local://lumina"
    default_builder: str = "noop"


class AbstractEnvironment(ABC):
    environment_type: str = "abstract"
    spec: EnvironmentSpec

    @abstractmethod
    def resolve_storage_uri(self, raw: str) -> str:
        """Resolve a possibly-relative storage URI to an absolute one."""


class LocalEnvironment(AbstractEnvironment):
    environment_type = "local"
    spec = EnvironmentSpec()

    def resolve_storage_uri(self, raw: str) -> str:
        if raw.startswith(("s3://", "gs://", "https://", "file://")):
            return raw
        from pathlib import Path

        return f"file://{Path(raw).resolve()}"


class AWSEnvironment(AbstractEnvironment):
    environment_type = "aws"
    spec = EnvironmentSpec(region="us-east-1", default_registry="<account>.dkr.ecr.us-east-1.amazonaws.com/lumina")

    def resolve_storage_uri(self, raw: str) -> str:
        if raw.startswith("s3://"):
            return raw
        return f"s3://{raw.lstrip('/')}"