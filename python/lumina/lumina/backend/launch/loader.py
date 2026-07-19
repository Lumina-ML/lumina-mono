"""Factory helpers that select the right builder/runner/registry/
environment implementation from a small config dict. Lets users override
defaults via the ``launch`` config without subclassing.
"""

from __future__ import annotations

from typing import Any

from .builder import AbstractBuilder, DockerBuilder, NoopBuilder
from .environment import AWSEnvironment, AbstractEnvironment, LocalEnvironment
from .registry import AbstractRegistry, LocalRegistry, S3Registry
from .runner import (
    AbstractRunner,
    LocalContainerRunner,
    LocalProcessRunner,
)


def builder_from_config(config: dict[str, Any] | None) -> AbstractBuilder:
    cfg = config or {}
    btype = cfg.get("builder", "noop")
    if btype == "docker":
        return DockerBuilder(docker_bin=cfg.get("docker_bin", "docker"))
    if btype == "noop":
        return NoopBuilder()
    raise ValueError(f"Unknown builder type: {btype}")


def runner_from_config(config: dict[str, Any] | None) -> AbstractRunner:
    cfg = config or {}
    rtype = cfg.get("runner", "local-process")
    if rtype == "local-process":
        return LocalProcessRunner()
    if rtype == "local-container":
        return LocalContainerRunner(docker_bin=cfg.get("docker_bin", "docker"))
    raise ValueError(f"Unknown runner type: {rtype}")


def registry_from_config(config: dict[str, Any] | None) -> AbstractRegistry:
    cfg = config or {}
    rtype = cfg.get("registry", "local")
    if rtype == "local":
        return LocalRegistry()
    if rtype == "s3":
        return S3Registry()
    raise ValueError(f"Unknown registry type: {rtype}")


def environment_from_config(config: dict[str, Any] | None) -> AbstractEnvironment:
    cfg = config or {}
    etype = cfg.get("environment", "local")
    if etype == "local":
        return LocalEnvironment()
    if etype == "aws":
        return AWSEnvironment()
    raise ValueError(f"Unknown environment type: {etype}")