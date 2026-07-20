#!/usr/bin/env bash
# Mirror what CI runs in .github/workflows/e2e.yml, locally.
#
# Usage:
#   bash scripts/e2e/run-ci-locally.sh         # full pipeline
#   SKIP_SERVER_E2E=1 bash scripts/e2e/run-ci-locally.sh
#
# Brings up Postgres + MinIO + ClickHouse + Redis + server via
# docker-compose, waits for /healthz, runs server unit tests + vitest
# e2e suite, then runs SDK pytest unit tests + the live-server E2E
# suite (tests/e2e/test_real_server.py).
#
# The script is intentionally idempotent — safe to re-run.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE="docker compose"
export LUMINA_API_URL="http://localhost:8000"
export LUMINA_API_KEY="${LUMINA_API_KEY:-ci-test-key}"
export LUMINA_WORKSPACE_ID="${LUMINA_WORKSPACE_ID:-default}"

pass() { printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; }

echo "== Bring up infra (postgres + minio + clickhouse + redis + server) =="
$COMPOSE up -d postgres minio clickhouse redis
$COMPOSE build server
$COMPOSE up -d server

# Wait for the server to answer /healthz (docker-compose
# `depends_on: healthy` + a Python-side poll for resilience).
echo "  waiting for /healthz..."
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$LUMINA_API_URL/healthz" || echo "000")
  if [ "$code" = "200" ]; then
    pass "server up"
    break
  fi
  sleep 2
done
if [ "$code" != "200" ]; then
  fail "server didn't reach /healthz"
  $COMPOSE logs server | tail -100
  exit 1
fi

overall=0

if [ -z "${SKIP_SERVER_UNIT:-}" ]; then
  echo "== Server unit tests =="
  if (cd "$ROOT/apps/server" && pnpm test); then
    pass "server unit tests"
  else
    fail "server unit tests"
    overall=1
  fi
fi

if [ -z "${SKIP_SERVER_E2E:-}" ]; then
  echo "== Server e2e (vitest + testcontainers) =="
  if (cd "$ROOT/apps/server" && pnpm test:e2e); then
    pass "server e2e tests"
  else
    fail "server e2e tests"
    overall=1
  fi
fi

echo "== SDK unit tests (fake_backend) =="
if (cd "$ROOT/python/lumina" && . .venv/bin/activate && pytest tests/); then
  pass "sdk unit tests"
else
  fail "sdk unit tests"
  overall=1
fi

echo "== SDK e2e against live server =="
if (cd "$ROOT/python/lumina" && . .venv/bin/activate && pytest tests/e2e/ -v); then
  pass "sdk e2e tests"
else
  fail "sdk e2e tests"
  overall=1
fi

echo "== Smoke: drive basic_experiment.py =="
if (cd "$ROOT/python/lumina" && . .venv/bin/activate && \
    LUMINA_API_URL="$LUMINA_API_URL" LUMINA_API_KEY="$LUMINA_API_KEY" \
    python "$ROOT/examples/basic_experiment.py"); then
  pass "examples/basic_experiment.py"
else
  fail "examples/basic_experiment.py"
  overall=1
fi

echo
if [ "$overall" -eq 0 ]; then
  printf "\033[32mCI pipeline green.\033[0m\n"
else
  printf "\033[31mCI pipeline failed.\033[0m\n"
  $COMPOSE logs server | tail -100
fi

if [ "${KEEP_CONTAINERS:-}" != "1" ]; then
  echo "== Tear down =="
  $COMPOSE down -v
fi

exit "$overall"
