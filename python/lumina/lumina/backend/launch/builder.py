"""Builder abstraction for Launch.

The builder is responsible for producing an OCI image from a job
specification (currently a no-op for in-process launches, or shelling out
to ``docker build`` for real containers). All builders expose a common
``build`` coroutine so the runner stays pluggable.
"""

from __future__ import annotations

import shutil
import subprocess
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


@dataclass
class BuildResult:
    image_uri: str
    """Fully-qualified image reference (e.g. ``my-registry.example.com/lumina/job-abc:v1``)."""
    digest: Optional[str] = None
    logs: Optional[str] = None


class AbstractBuilder(ABC):
    """Subclasses describe how to turn a LaunchJob into an image."""

    builder_type: str = "abstract"

    @abstractmethod
    def build(
        self,
        *,
        job_name: str,
        context_dir: Optional[Path] = None,
        dockerfile: Optional[Path] = None,
        tag: Optional[str] = None,
    ) -> BuildResult:
        """Produce an image artifact for ``job_name`` and return its URI."""


class NoopBuilder(AbstractBuilder):
    """No-op builder for local-process runners. Returns a synthetic URI so
    downstream code can carry an ``image`` field without checking."""

    builder_type = "noop"

    def build(
        self,
        *,
        job_name: str,
        context_dir: Optional[Path] = None,
        dockerfile: Optional[Path] = None,
        tag: Optional[str] = None,
    ) -> BuildResult:
        return BuildResult(image_uri=f"noop://{job_name}", digest=None)


class DockerBuilder(AbstractBuilder):
    """Shell out to the local ``docker`` CLI to build an image.

    Requires ``docker`` on PATH. The builder is best-effort: if the build
    command returns a non-zero exit code the resulting ``BuildResult.logs``
    will carry stderr but no exception is raised (callers can inspect).
    """

    builder_type = "docker"

    def __init__(self, docker_bin: str = "docker") -> None:
        self._docker = docker_bin

    def is_available(self) -> bool:
        return shutil.which(self._docker) is not None

    def build(
        self,
        *,
        job_name: str,
        context_dir: Optional[Path] = None,
        dockerfile: Optional[Path] = None,
        tag: Optional[str] = None,
    ) -> BuildResult:
        if not self.is_available():
            raise RuntimeError(
                f"docker binary not found on PATH ({self._docker!r})"
            )
        context = context_dir or Path.cwd()
        df = dockerfile or context / "Dockerfile"
        if not df.exists():
            raise FileNotFoundError(f"Dockerfile not found: {df}")
        image_tag = tag or f"lumina/{job_name}:latest"
        cmd = [
            self._docker,
            "build",
            "-f",
            str(df),
            "-t",
            image_tag,
            str(context),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        digest = self._parse_digest(result.stdout)
        return BuildResult(image_uri=image_tag, digest=digest, logs=result.stdout + result.stderr)

    @staticmethod
    def _parse_digest(stdout: str) -> Optional[str]:
        for line in stdout.splitlines():
            line = line.strip()
            if line.startswith("sha256:"):
                return line.split()[0]
        return None