#!/usr/bin/env python3
"""Unified runner for Lumina Wandb scenario benchmarks.

Usage:
    python benchmarks/scenario_runner.py --mode real --level S
    python benchmarks/scenario_runner.py --mode real --level M --scenario ET-1 ET-2
    python benchmarks/scenario_runner.py --mode fake --level S

Each scenario outputs one JSON line; a summary table is printed at the end.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Literal

# Allow running `python benchmarks/scenario_runner.py` from the repo root.
BENCH_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BENCH_DIR))

from scenarios.base import Scenario, ScenarioResult
from scenarios.experiment_tracking import (
    ExperimentLifecycleScenario,
    MetricThroughputScenario,
)

SCENARIOS: dict[str, type[Scenario]] = {
    ExperimentLifecycleScenario.scenario_id: ExperimentLifecycleScenario,
    MetricThroughputScenario.scenario_id: MetricThroughputScenario,
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Lumina Wandb scenario benchmarks")
    parser.add_argument(
        "--mode",
        choices=("fake", "real"),
        default="real",
        help="Backend mode: fake (fast/CI) or real (acceptance).",
    )
    parser.add_argument(
        "--level",
        choices=("S", "M", "L", "XL"),
        default="S",
        help="Data size level.",
    )
    parser.add_argument(
        "--scenario",
        nargs="+",
        help="Run only these scenario IDs (default: all registered).",
    )
    args = parser.parse_args()

    mode: Literal["fake", "real"] = args.mode
    level: Literal["S", "M", "L", "XL"] = args.level
    wanted = set(args.scenario) if args.scenario else set(SCENARIOS.keys())

    results: list[ScenarioResult] = []
    for sid in sorted(wanted):
        cls = SCENARIOS.get(sid)
        if cls is None:
            print(f"SKIP: unknown scenario {sid}", file=sys.stderr)
            continue

        scenario = cls(level=level, mode=mode)
        try:
            scenario.setup()
            result = scenario.run()
            scenario.teardown()
        except BaseException as exc:  # noqa: BLE001
            result = ScenarioResult(
                scenario_id=sid,
                level=level,
                mode=mode,
                status="failed",
                error=f"{type(exc).__name__}: {exc}",
            )
        results.append(result)
        print(result.to_json())

    # Summary table
    print("\n" + "=" * 80)
    print(f"{'Scenario':<10} {'Level':<6} {'Mode':<6} {'Status':<8} {'Metrics'}")
    print("=" * 80)
    passed = failed = skipped = 0
    for r in results:
        if r.status == "passed":
            passed += 1
        elif r.status == "failed":
            failed += 1
        else:
            skipped += 1
        metrics_summary = " ".join(f"{k}={v}" for k, v in r.metrics.items())
        print(f"{r.scenario_id:<10} {r.level:<6} {r.mode:<6} {r.status:<8} {metrics_summary}")
        if r.error:
            print(f"  ERROR: {r.error}")

    print("=" * 80)
    print(f"PASSED={passed} FAILED={failed} SKIPPED={skipped}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
