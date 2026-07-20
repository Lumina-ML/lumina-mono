"""Base class and result type for Wandb scenario benchmarks."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class ScenarioResult:
    """Result returned by a single scenario execution."""

    scenario_id: str
    level: Literal["S", "M", "L", "XL"]
    mode: Literal["fake", "real"]
    status: Literal["passed", "failed", "skipped"] = "passed"
    metrics: dict[str, Any] = field(default_factory=dict)
    assertions: dict[str, bool] = field(default_factory=dict)
    error: str | None = None

    def to_json(self) -> str:
        return json.dumps(
            {
                "scenario": self.scenario_id,
                "level": self.level,
                "mode": self.mode,
                "status": self.status,
                "metrics": self.metrics,
                "assertions": self.assertions,
                "error": self.error,
            },
            default=str,
        )


class Scenario:
    """Abstract base for a single benchmark scenario.

    Subclasses must set ``scenario_id`` and implement ``run``.
    """

    scenario_id: str = ""
    name: str = ""

    def __init__(self, level: Literal["S", "M", "L", "XL"], mode: Literal["fake", "real"] = "real") -> None:
        self.level = level
        self.mode = mode

    def setup(self) -> None:
        """One-time preparation before ``run``."""
        pass

    def run(self) -> ScenarioResult:
        """Execute the scenario and return metrics + assertions."""
        raise NotImplementedError

    def teardown(self) -> None:
        """Cleanup after ``run``."""
        pass

    def params(self) -> dict[str, Any]:
        """Return data-size parameters for the current level."""
        return LEVEL_PARAMS[self.level]


LEVEL_PARAMS: dict[str, dict[str, Any]] = {
    "S": {
        "metrics_per_run": 10,
        "steps": 10,
        "log_lines": 50,
        "artifact_size_mb": 1,
        "files_per_artifact": 1,
        "spans_per_trace": 10,
        "concurrent_runs": 1,
    },
    "M": {
        "metrics_per_run": 1_000,
        "steps": 1_000,
        "log_lines": 5_000,
        "artifact_size_mb": 100,
        "files_per_artifact": 100,
        "spans_per_trace": 100,
        "concurrent_runs": 4,
    },
    "L": {
        "metrics_per_run": 100_000,
        "steps": 100_000,
        "log_lines": 50_000,
        "artifact_size_mb": 1_000,
        "files_per_artifact": 1_000,
        "spans_per_trace": 1_000,
        "concurrent_runs": 16,
    },
    "XL": {
        "metrics_per_run": 1_000_000,
        "steps": 1_000_000,
        "log_lines": 500_000,
        "artifact_size_mb": 5_000,
        "files_per_artifact": 10_000,
        "spans_per_trace": 10_000,
        "concurrent_runs": 64,
    },
}
