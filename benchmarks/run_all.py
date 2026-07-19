#!/usr/bin/env python3
"""Run every Lumina benchmark against a local backend, in isolated
subprocesses, and print a pass / skip / fail summary.

Usage:
    python benchmarks/run_all.py
"""

import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

BENCH_DIR = Path(__file__).resolve().parent
API_URL = os.getenv("LUMINA_API_URL", "http://localhost:8000")


def check_server() -> bool:
    try:
        with urllib.request.urlopen(f"{API_URL}/healthz", timeout=5) as resp:
            return resp.status == 200
    except (urllib.error.URLError, OSError) as exc:
        print(f"Cannot reach Lumina server at {API_URL} (/healthz): {exc}")
        print("Start it first, e.g. `docker compose up`.")
        return False


def main() -> int:
    if not check_server():
        return 2

    scripts = sorted(p for p in BENCH_DIR.glob("*_benchmark.py"))
    env = {**os.environ, "LUMINA_API_URL": API_URL}

    passed, skipped, failed = [], [], []
    for script in scripts:
        print(f"\n{'=' * 70}\n▶ {script.name}\n{'=' * 70}")
        proc = subprocess.run(
            [sys.executable, str(script)], env=env, capture_output=True, text=True
        )
        sys.stdout.write(proc.stdout)
        if proc.stderr:
            sys.stderr.write(proc.stderr)

        if proc.returncode != 0:
            failed.append(script.name)
        elif "SKIP:" in proc.stdout:
            skipped.append(script.name)
        else:
            passed.append(script.name)

    print(f"\n{'=' * 70}\nSUMMARY\n{'=' * 70}")
    print(f"  PASSED  ({len(passed)}): {', '.join(passed) or '-'}")
    print(f"  SKIPPED ({len(skipped)}): {', '.join(skipped) or '-'}")
    print(f"  FAILED  ({len(failed)}): {', '.join(failed) or '-'}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
