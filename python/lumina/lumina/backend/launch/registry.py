"""Registry abstraction for image storage.

A registry stores built images and produces URIs other agents can pull.
For self-hosted Lumina the local filesystem acts as the registry; for
real deployments ``S3Registry`` provides a stub pointing at an
``s3://...`` bucket that a docker-push equivalent can resolve.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class RegistryImage:
    uri: str
    digest: str | None = None


class AbstractRegistry(ABC):
    registry_type: str = "abstract"
    uri: str = ""

    @abstractmethod
    def image_uri(self, job_name: str, tag: str = "latest") -> str:
        """Compose a fully-qualified image reference for ``job_name``."""


class LocalRegistry(AbstractRegistry):
    """In-process registry that just composes deterministic URIs. Useful
    for testing and for jobs that don't actually need a docker image
    (i.e. ``NoopBuilder`` consumers)."""

    registry_type = "local"
    uri = "local://lumina"

    def image_uri(self, job_name: str, tag: str = "latest") -> str:
        return f"{self.uri}/{job_name}:{tag}"


class S3Registry(AbstractRegistry):
    """Stub that maps ``job_name`` to an ``s3://`` URI. Real upload is
    intentionally out of scope for this iteration; consumers can plug in
    a builder that calls ``aws ecr get-login-password`` etc."""

    registry_type = "s3"
    uri = "s3://lumina-images"

    def image_uri(self, job_name: str, tag: str = "latest") -> str:
        return f"{self.uri}/{job_name}/{tag}.tar"