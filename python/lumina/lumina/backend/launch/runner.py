"""Runner abstraction for Launch.

A runner takes a claimed LaunchRun and executes it somewhere — locally
(subprocess), in a container (docker run), or on a remote cluster. The
runner returns a :class:`RunResult` describing the outcome; the agent
loop is responsible for translating that into the appropriate status
patch on the server.
"""

from __future__ import annotations

import os
import subprocess
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


@dataclass
class RunResult:
    exit_code: int
    stdout: str = ""
    stderr: str = ""
    image_uri: Optional[str] = None
    runner_type: str = "abstract"
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.exit_code == 0


class AbstractRunner(ABC):
    runner_type: str = "abstract"

    @abstractmethod
    def run(self, run: dict[str, Any]) -> RunResult:
        """Execute ``run`` (a LaunchRun dict with nested ``job``) and
        return the structured outcome."""


class LocalProcessRunner(AbstractRunner):
    """Spawn the job's ``command + args`` as a local subprocess. This is
    the original behavior of the minimal launch module and is the default
    runner when the job's ``image`` field is unset."""

    runner_type = "local-process"

    def run(self, run: dict[str, Any]) -> RunResult:
        job = run.get("job") or {}
        command = list(job.get("command") or [])
        args = list(job.get("args") or [])
        env = {**os.environ, **(job.get("env") or {})}
        full_command = command + args
        if not full_command:
            return RunResult(exit_code=0, runner_type=self.runner_type)
        proc = subprocess.run(full_command, env=env, capture_output=True, text=True, check=False)
        return RunResult(
            exit_code=proc.returncode,
            stdout=proc.stdout,
            stderr=proc.stderr,
            runner_type=self.runner_type,
        )


class LocalContainerRunner(AbstractRunner):
    """Use the local ``docker`` CLI to run the job's image. The runner
    honors ``job.image``; if no image is set it falls back to executing
    the command directly so the abstraction stays backwards-compatible."""

    runner_type = "local-container"

    def __init__(self, docker_bin: str = "docker") -> None:
        self._docker = docker_bin

    def run(self, run: dict[str, Any]) -> RunResult:
        import shutil

        job = run.get("job") or {}
        image = job.get("image")
        command = list(job.get("command") or [])
        args = list(job.get("args") or [])
        env = job.get("env") or {}
        full_command = command + args

        if image and shutil.which(self._docker) is not None:
            cmd: list[str] = [self._docker, "run", "--rm"]
            for k, v in env.items():
                cmd.extend(["-e", f"{k}={v}"])
            cmd.append(image)
            cmd.extend(full_command)
            proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
            return RunResult(
                exit_code=proc.returncode,
                stdout=proc.stdout,
                stderr=proc.stderr,
                image_uri=image,
                runner_type=self.runner_type,
            )
        # Fallback: behave like LocalProcessRunner when docker is unavailable
        # or the job doesn't specify an image.
        return LocalProcessRunner().run(run)


def select_runner(run: dict[str, Any], *, docker_runner: Optional[LocalContainerRunner] = None) -> AbstractRunner:
    """Pick the right runner for a given LaunchRun. The rule:
    - If ``job.image`` is set, use the docker-backed runner.
    - Otherwise fall back to the local-process runner.
    """
    image = (run.get("job") or {}).get("image")
    if image:
        return docker_runner or LocalContainerRunner()
    return LocalProcessRunner()