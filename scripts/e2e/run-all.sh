#!/usr/bin/env bash
# Lumina E2E test harness.
#
# Runs every test suite in the monorepo and reports a single green/red exit
# code. Intended for CI and for "is the Phase N work actually done?"
# verification.
#
# Usage:
#   ./scripts/e2e/run-all.sh           # full run
#   ./scripts/e2e/run-all.sh --no-sdk   # server-only
#   ./scripts/e2e/run-all.sh --no-server

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN_SERVER=1
RUN_SDK=1

for arg in "$@"; do
  case "$arg" in
    --no-server) RUN_SERVER=0 ;;
    --no-sdk)    RUN_SDK=0 ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

pass() { printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; }

run_server() {
  echo "== Server (vitest, apps/server) =="
  if (cd "$ROOT/apps/server" && pnpm vitest run); then
    pass "server tests"
  else
    fail "server tests"
    return 1
  fi
}

run_sdk() {
  echo "== SDK (pytest, python/lumina) =="
  PY="$ROOT/python/lumina/.venv/bin/python"
  if [ ! -x "$PY" ]; then
    PY="python3"
  fi
  if (cd "$ROOT/python/lumina" && "$PY" -m pytest tests/); then
    pass "sdk tests"
  else
    fail "sdk tests"
    return 1
  fi
}

overall=0
if [ "$RUN_SERVER" -eq 1 ]; then
  run_server || overall=1
fi
if [ "$RUN_SDK" -eq 1 ]; then
  run_sdk || overall=1
fi

echo
if [ "$overall" -eq 0 ]; then
  printf "\033[32mAll suites green.\033[0m\n"
else
  printf "\033[31mOne or more suites failed.\033[0m\n"
  exit 1
fi