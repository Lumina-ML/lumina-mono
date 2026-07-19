"""Tests for the SDK launch abstractions (builder / runner / registry / environment)."""

from __future__ import annotations

from typing import Any

import pytest

from lumina.backend.launch import (
    AWSEnvironment,
    AbstractBuilder,
    AbstractRunner,
    DockerBuilder,
    LocalContainerRunner,
    LocalEnvironment,
    LocalProcessRunner,
    LocalRegistry,
    NoopBuilder,
    RunResult,
    S3Registry,
    builder_from_config,
    environment_from_config,
    launch,
    launch_agent,
    registry_from_config,
    runner_from_config,
    select_runner,
)
from lumina.backend.launch.runner import select_runner as _select_runner


class TestBuilders:
    def test_noop_builder_returns_synthetic_uri(self) -> None:
        result = NoopBuilder().build(job_name="train")
        assert result.image_uri == "noop://train"
        assert result.digest is None

    def test_docker_builder_is_abstract_subclass(self) -> None:
        assert issubclass(DockerBuilder, AbstractBuilder)
        assert DockerBuilder().is_available() in (True, False)

    def test_builder_from_config_dispatches(self) -> None:
        assert isinstance(builder_from_config(None), NoopBuilder)
        assert isinstance(builder_from_config({"builder": "noop"}), NoopBuilder)
        assert isinstance(builder_from_config({"builder": "docker"}), DockerBuilder)
        with pytest.raises(ValueError):
            builder_from_config({"builder": "unknown"})


class TestRunners:
    def test_local_process_runner_executes_command(self) -> None:
        runner = LocalProcessRunner()
        result = runner.run({"job": {"command": ["echo", "hi"], "args": [], "env": {}}})
        assert result.ok
        assert "hi" in result.stdout
        assert result.runner_type == "local-process"

    def test_local_process_runner_propagates_exit_code(self) -> None:
        result = LocalProcessRunner().run({"job": {"command": ["false"], "args": [], "env": {}}})
        assert result.exit_code != 0
        assert result.ok is False

    def test_local_process_runner_no_command_is_noop(self) -> None:
        result = LocalProcessRunner().run({"job": {}})
        assert result.ok
        assert result.runner_type == "local-process"

    def test_local_container_runner_subclass(self) -> None:
        assert issubclass(LocalContainerRunner, AbstractRunner)

    def test_select_runner_picks_docker_when_image_set(self) -> None:
        runner = _select_runner({"job": {"image": "ubuntu:22.04"}})
        assert isinstance(runner, LocalContainerRunner)

    def test_select_runner_picks_local_process_when_no_image(self) -> None:
        runner = _select_runner({"job": {"command": ["echo"]}})
        assert isinstance(runner, LocalProcessRunner)

    def test_runner_from_config_dispatches(self) -> None:
        assert isinstance(runner_from_config(None), LocalProcessRunner)
        assert isinstance(runner_from_config({"runner": "local-container"}), LocalContainerRunner)
        with pytest.raises(ValueError):
            runner_from_config({"runner": "k8s"})


class TestRegistries:
    def test_local_registry_image_uri(self) -> None:
        reg = LocalRegistry()
        assert reg.image_uri("train") == "local://lumina/train:latest"

    def test_s3_registry_image_uri(self) -> None:
        reg = S3Registry()
        assert "s3://" in reg.image_uri("train", tag="v1")

    def test_registry_from_config(self) -> None:
        assert isinstance(registry_from_config(None), LocalRegistry)
        assert isinstance(registry_from_config({"registry": "s3"}), S3Registry)
        with pytest.raises(ValueError):
            registry_from_config({"registry": "ecr"})


class TestEnvironments:
    def test_local_environment_resolves_storage_uri(self, tmp_path) -> None:
        env = LocalEnvironment()
        resolved = env.resolve_storage_uri(str(tmp_path / "x"))
        assert resolved.startswith("file://")

    def test_aws_environment_resolves_storage_uri(self) -> None:
        env = AWSEnvironment()
        assert env.resolve_storage_uri("s3://bucket/key") == "s3://bucket/key"
        assert env.resolve_storage_uri("bucket/key") == "s3://bucket/key"

    def test_environment_from_config(self) -> None:
        assert isinstance(environment_from_config(None), LocalEnvironment)
        assert isinstance(environment_from_config({"environment": "aws"}), AWSEnvironment)
        with pytest.raises(ValueError):
            environment_from_config({"environment": "gcp"})


pytest_plugins = ["fake_backend"]


@pytest.fixture
def lumina_env(monkeypatch: pytest.MonkeyPatch, fake_backend: tuple[str, Any]):
    base_url, backend = fake_backend
    monkeypatch.setenv("LUMINA_API_URL", base_url)
    monkeypatch.setenv("LUMINA_API_KEY", "test-key")
    from lumina.backend import run_context as _rc

    _rc.reset_run_context()
    _rc.get_run_context().project = "demo"
    yield backend
    _rc.reset_run_context()


def test_launch_enqueues_via_abstract_builder(lumina_env) -> None:
    """``launch`` accepts an AbstractBuilder and stamps its image URI into
    the LaunchRun metadata via the server."""
    queue = lumina_env.create_launch_queue("demo", "q1")
    job = lumina_env.create_launch_job("demo", "j1", command=["echo"], args=[])

    builder = NoopBuilder()
    registry = LocalRegistry()
    result = launch(queue["id"], job["id"], project="demo", builder=builder, registry=registry)
    assert result["id"].startswith("lr-")
    fetched = lumina_env.get_launch_run(result["id"])
    assert fetched["metadata"]["image_uri"] == "noop://" + job["id"]
    assert fetched["metadata"]["registry_uri"] == "local://lumina"


def test_launch_agent_executes_via_runner(lumina_env) -> None:
    queue = lumina_env.create_launch_queue("demo", "q1")
    job = lumina_env.create_launch_job(
        "demo", "j1", command=["echo", "hello-from-agent"], args=[]
    )
    lumina_env.create_launch_run("demo", queue["id"], job["id"])

    executed = launch_agent(queue["id"], project="demo", max_runs=1)
    assert len(executed) == 1
    status = lumina_env.get_launch_run(executed[0]["id"])["status"]
    assert status == "completed"