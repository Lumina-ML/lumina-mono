#!/usr/bin/env python3
"""Unattended runner for Lumina Wandb scenario benchmarks at real M and L levels.

Usage:
    python benchmarks/run_scenario_ml_levels.py

What it does:
    1. Runs `scenario_runner.py --mode real --level M`.
    2. Runs `scenario_runner.py --mode real --level L`.
    3. Saves per-level logs under `benchmarks/logs/`.
    4. Parses each log and appends a summary block to `benchmarks/Benchmark-Issues.md`.

Safe to start and leave running; it does not require interactive supervision.
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

BENCH_DIR = Path(__file__).resolve().parent
LUMINA_ROOT = BENCH_DIR.parent / "python" / "lumina"
LOG_DIR = BENCH_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
ISSUES_FILE = BENCH_DIR / "Benchmark-Issues.md"


def run_level(level: str) -> tuple[int, Path]:
    """Run scenario_runner for one level and return (returncode, log_file)."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    log_file = LOG_DIR / f"scenario_real_{level}_{timestamp}.log"
    cmd = [
        "uv",
        "run",
        "python",
        str(BENCH_DIR / "scenario_runner.py"),
        "--mode",
        "real",
        "--level",
        level,
    ]
    print(f"[{level}] starting: {' '.join(cmd)}", flush=True)
    print(f"[{level}] log -> {log_file}", flush=True)
    with open(log_file, "w", encoding="utf-8") as f:
        proc = subprocess.run(
            cmd,
            cwd=LUMINA_ROOT,
            stdout=f,
            stderr=subprocess.STDOUT,
            text=True,
        )
    return proc.returncode, log_file


def parse_log(log_file: Path) -> dict:
    """Parse scenario_runner JSON lines and final summary from a log file."""
    results: list[dict] = []
    summary: dict[str, int] = {}
    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("{"):
                try:
                    results.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
            elif line.startswith("PASSED="):
                for part in line.split():
                    if "=" in part:
                        key, value = part.split("=", 1)
                        try:
                            summary[key] = int(value)
                        except ValueError:
                            summary[key] = value  # type: ignore[assignment]
    return {"results": results, "summary": summary}


def append_to_issues(level: str, rc: int, log_file: Path, parsed: dict) -> None:
    """Append a compact summary of one level's run to Benchmark-Issues.md."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "",
        f"## 自动跑测补充：real {level} 级（{now}）",
        "",
        f"- 命令：`uv run python scenario_runner.py --mode real --level {level}`",
        f"- 日志：`{log_file.relative_to(BENCH_DIR)}`",
        f"- 退出码：`{rc}`",
        (
            f"- 汇总：PASSED={parsed['summary'].get('PASSED', '?')} "
            f"FAILED={parsed['summary'].get('FAILED', '?')} "
            f"SKIPPED={parsed['summary'].get('SKIPPED', '?')}"
        ),
        "",
        "### 各场景结果",
        "",
        "| Scenario | Status | 关键指标 / 错误 |",
        "|---|---|---|",
    ]

    for r in parsed["results"]:
        sid = r.get("scenario_id") or r.get("scenario", "?")
        status = r.get("status", "?")
        err = r.get("error", "")
        metrics = r.get("metrics", {})
        detail = err if err else " ".join(f"{k}={v}" for k, v in metrics.items())
        # Keep table cells single-line and reasonably short
        detail = detail.replace("\n", " ").replace("|", "\\|")
        lines.append(f"| {sid} | {status} | {detail} |")

    failed = [r for r in parsed["results"] if r.get("status") == "failed"]
    if failed:
        lines.extend([
            "",
            "### 新增 failed 场景",
            "",
        ])
        for r in failed:
            sid = r.get("scenario_id") or r.get("scenario", "?")
            err = (r.get("error", "") or "").replace("\n", " ")
            lines.append(f"- `{sid}`: {err}")

    lines.append("")
    with open(ISSUES_FILE, "a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main() -> int:
    print(f"[{datetime.now().isoformat()}] Unattended M/L benchmark run started", flush=True)
    print(f"Logs will be saved to: {LOG_DIR}", flush=True)
    print(f"Results will be appended to: {ISSUES_FILE}", flush=True)

    for level in ("M", "L"):
        rc, log_file = run_level(level)
        parsed = parse_log(log_file)
        append_to_issues(level, rc, log_file, parsed)
        print(
            f"[{level}] finished rc={rc} PASSED={parsed['summary'].get('PASSED', '?')} "
            f"FAILED={parsed['summary'].get('FAILED', '?')} SKIPPED={parsed['summary'].get('SKIPPED', '?')}",
            flush=True,
        )

    print(f"[{datetime.now().isoformat()}] All done. See {ISSUES_FILE} for summaries.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
