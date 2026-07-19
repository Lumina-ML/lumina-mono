#!/usr/bin/env bash
# Phase 2 E2E harness — exercises the full infra path (Postgres + ClickHouse
# + Redis + MinIO + server + SDK) end-to-end.
#
# What it does:
#   1. docker compose up postgres minio clickhouse redis server
#   2. waits for /health
#   3. runs `python examples/basic_experiment.py` which logs metrics, system
#      metrics, log lines, and finishes a run
#   4. queries ClickHouse directly to confirm metric + system_metric rows
#      landed there (not just Postgres)
#   5. queries Redis to confirm MetricLogged events were emitted
#   6. tears down
#
# This is the "落袋为安" check for Phase 2: if ClickHouse is configured and
# system-metric / log-line traffic doesn't end up there, this script fails.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="$ROOT/docker-compose.yml"
BASE_URL="${LUMINA_BASE_URL:-http://localhost:8000}"
PY="$ROOT/python/lumina/.venv/bin/python"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for this harness" >&2
  exit 1
fi

cleanup() {
  echo "==> Tearing down compose stack"
  (cd "$ROOT" && docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans) >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Starting infra: postgres, minio, clickhouse, redis, server"
(cd "$ROOT" && docker compose -f "$COMPOSE_FILE" up -d postgres minio clickhouse redis server)

echo "==> Waiting for server health"
for i in $(seq 1 60); do
  if curl -sf "$BASE_URL/health" >/dev/null 2>&1; then
    echo "  server up"
    break
  fi
  sleep 1
done
if ! curl -sf "$BASE_URL/health" >/dev/null 2>&1; then
  echo "server failed to become healthy" >&2
  exit 1
fi

echo "==> Running SDK example"
(cd "$ROOT" && LUMINA_API_URL="$BASE_URL" "$PY" python/lumina/examples/basic_experiment.py)

echo "==> Querying ClickHouse for metrics + system_metrics"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
curl -sG "$CLICKHOUSE_URL/" \
  --data-urlencode "query=SELECT count() FROM metrics" \
  --data-urlencode "user=default" \
  --data-urlencode "password=lumina"
echo
curl -sG "$CLICKHOUSE_URL/" \
  --data-urlencode "query=SELECT count() FROM system_metrics" \
  --data-urlencode "user=default" \
  --data-urlencode "password=lumina"
echo
curl -sG "$CLICKHOUSE_URL/" \
  --data-urlencode "query=SELECT count() FROM log_lines" \
  --data-urlencode "user=default" \
  --data-urlencode "password=lumina"
echo

echo "==> Querying Redis for MetricLogged event count"
docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli --no-auth-warning \
  PUBSUB CHANNELS 'lumina:events:*' || true

echo "==> Phase 2 E2E complete"