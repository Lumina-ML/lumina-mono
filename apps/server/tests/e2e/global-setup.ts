/**
 * Vitest globalSetup for the E2E suite.
 *
 * Brings up real Docker containers for Postgres, ClickHouse, Redis, and
 * MinIO via testcontainers, applies Prisma migrations to the Postgres
 * one, then publishes the connection URLs as env vars so individual
 * tests can pick them up via `process.env`.
 *
 * The containers live for the duration of one `vitest run` invocation
 * (vitest calls our returned teardown function before exiting). This
 * is much faster than starting containers per-test (the cold start
 * alone is ~5s per container) while still giving each run a clean
 * database — `beforeEach` in the suite truncates tables so no state
 * leaks between tests.
 *
 * Why not reuse the dev docker-compose stack?
 *   - Avoids polluting the developer's working database
 *   - CI doesn't have to assume docker-compose is up
 *   - Each test run is hermetic and reproducible
 *
 * If you DO want to point at a running stack for fast iteration, set
 * `LUMINA_E2E_REUSE=1` and the URLs below will be used as-is (see
 * `resolveEnv()`).
 */

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { ClickHouseContainer, type StartedClickHouseContainer } from "@testcontainers/clickhouse";
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import { MinioContainer, type StartedMinioContainer } from "@testcontainers/minio";
import { execSync } from "node:child_process";
import { Client } from "pg";

interface StartedInfra {
  postgres: StartedPostgreSqlContainer;
  clickhouse: StartedClickHouseContainer;
  redis: StartedRedisContainer;
  minio: StartedMinioContainer;
}

let started: StartedInfra | null = null;

const ENV_KEYS = [
  "DATABASE_URL",
  "CLICKHOUSE_URL",
  "CLICKHOUSE_USER",
  "CLICKHOUSE_PASSWORD",
  "CLICKHOUSE_DB",
  "REDIS_URL",
  "STORAGE_TYPE",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_FORCE_PATH_STYLE",
] as const;

/**
 * Resolve the env from either running containers (the default) or from
 * an already-running stack the developer points at via LUMINA_E2E_REUSE.
 */
function resolveEnv(): Record<(typeof ENV_KEYS)[number], string> {
  return {
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    CLICKHOUSE_URL: process.env.CLICKHOUSE_URL ?? "",
    CLICKHOUSE_USER: process.env.CLICKHOUSE_USER ?? "default",
    CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD ?? "lumina",
    CLICKHOUSE_DB: process.env.CLICKHOUSE_DB ?? "lumina",
    REDIS_URL: process.env.REDIS_URL ?? "",
    STORAGE_TYPE: process.env.STORAGE_TYPE ?? "s3",
    S3_ENDPOINT: process.env.S3_ENDPOINT ?? "",
    S3_BUCKET: process.env.S3_BUCKET ?? "lumina-artifacts",
    S3_REGION: process.env.S3_REGION ?? "us-east-1",
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "",
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "",
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE ?? "true",
  };
}

async function startFresh(): Promise<StartedInfra> {
  // S3 env vars the Minio container defaults to (matches our docker-compose).
  const S3_ACCESS_KEY_ID = "minioadmin";
  const S3_SECRET_ACCESS_KEY = "minioadmin";
  const S3_BUCKET = "lumina-artifacts";

  // Kick off the four containers in parallel; each takes ~3-6s on a warm
  // docker daemon so this saves noticeable wall time vs sequential.
  const [postgres, clickhouse, redis, minio] = await Promise.all([
    new PostgreSqlContainer("postgres:15-alpine")
      .withDatabase("lumina")
      .withUsername("lumina")
      .withPassword("lumina")
      .start(),
    new ClickHouseContainer("clickhouse/clickhouse-server:latest")
      .withUsername("default")
      .withPassword("lumina")
      .withDatabase("lumina")
      .start(),
    new RedisContainer("redis:7-alpine").start(),
    new MinioContainer("minio/minio:latest")
      .withUsername(S3_ACCESS_KEY_ID)
      .withPassword(S3_SECRET_ACCESS_KEY)
      .start(),
  ]);

  return { postgres, clickhouse, redis, minio };
}

/**
 * Apply Prisma migrations to the started Postgres container. We don't
 * use `prisma migrate deploy` directly because the Prisma CLI wants to
 * load `.env` files; instead we point the CLI at the test container
 * via DATABASE_URL on the command line.
 */
async function applyMigrations(databaseUrl: string): Promise<void> {
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  execSync("pnpm exec prisma migrate deploy", {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
}

/**
 * Make sure the MinIO bucket exists. The MinIO client used in tests is
 * just `aws-sdk`, which doesn't auto-create buckets on first request
 * against S3, so we pre-create via the `mc` CLI from a one-shot
 * container.
 *
 * The `minio/mc` image's entrypoint IS `mc`, so we invoke its
 * subcommands as positional args rather than wrapping in `sh -c`.
 * Spinning two `mc` calls instead of one keeps us compatible with
 * every mc release.
 */
async function ensureBucket(
  endpoint: string,
  accessKey: string,
  secretKey: string,
  bucket: string,
): Promise<void> {
  const url = new URL(endpoint);
  const alias = "lumina";
  execSync(
    `docker run --rm --network host minio/mc:latest alias set ${alias} ${url.origin} ${accessKey} ${secretKey}`,
    { stdio: "inherit" },
  );
  execSync(
    `docker run --rm --network host minio/mc:latest mb --ignore-existing ${alias}/${bucket}`,
    { stdio: "inherit" },
  );
}

/**
 * Wait for ClickHouse to be reachable. The ClickHouseContainer reports
 * ready via its healthcheck but the driver the server uses still has a
 * race on cold boot; a tiny probe gives us deterministic readiness.
 *
 * Probes the bare HTTP URL (no auth, no database path) since that's
 * what the @clickhouse/client healthcheck uses internally too.
 */
async function probeClickHouse(httpUrl: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (true) {
    try {
      const res = await fetch(`${httpUrl}/ping`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    if (Date.now() > deadline) {
      throw new Error(`ClickHouse not reachable at ${httpUrl}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

export async function setup(): Promise<void> {
  const reuse = process.env.LUMINA_E2E_REUSE === "1";
  const env = resolveEnv();

  if (reuse) {
    if (!env.DATABASE_URL || !env.REDIS_URL || !env.S3_ENDPOINT) {
      throw new Error(
        "LUMINA_E2E_REUSE=1 requires DATABASE_URL, REDIS_URL, and S3_ENDPOINT to be set",
      );
    }
    console.log("[e2e] Reusing external infra (LUMINA_E2E_REUSE=1)");
  } else {
    console.log("[e2e] Starting testcontainers…");
    const t0 = Date.now();
    started = await startFresh();
    console.log(`[e2e] Containers up in ${Date.now() - t0}ms`);

    env.DATABASE_URL = started.postgres.getConnectionUri();
    env.REDIS_URL = started.redis.getConnectionUrl();
    env.CLICKHOUSE_URL = started.clickhouse.getConnectionUrl();
    env.S3_ENDPOINT = `http://${started.minio.getHost()}:${started.minio.getMappedPort(9000)}`;
    env.S3_ACCESS_KEY_ID = "minioadmin";
    env.S3_SECRET_ACCESS_KEY = "minioadmin";
    env.S3_BUCKET = "lumina-artifacts";

    await applyMigrations(env.DATABASE_URL);
    await ensureBucket(env.S3_ENDPOINT, env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY, env.S3_BUCKET);
    await probeClickHouse(started.clickhouse.getHttpUrl());
    console.log("[e2e] Postgres migrated; MinIO bucket ready; ClickHouse reachable");
  }

  for (const key of ENV_KEYS) {
    process.env[key] = env[key];
  }

  // Smoke-test the Postgres connection so a misconfigured test run fails
  // fast in globalSetup rather than inside the first test.
  if (!reuse) {
    const pg = new Client({ connectionString: env.DATABASE_URL });
    await pg.connect();
    await pg.query("SELECT 1");
    await pg.end();
  }
}

export async function teardown(): Promise<void> {
  if (!started) return;
  console.log("[e2e] Stopping testcontainers…");
  await Promise.allSettled([
    started.postgres.stop(),
    started.clickhouse.stop(),
    started.redis.stop(),
    started.minio.stop(),
  ]);
  started = null;
}