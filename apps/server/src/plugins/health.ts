/**
 * Liveness and readiness endpoints.
 *
 * - `GET /healthz` — always returns 200 once the process can accept
 *   connections. Used by container orchestrators as the liveness probe.
 *
 * - `GET /readyz` — checks that the storage backends the server depends
 *   on are reachable. Returns 503 with a JSON body listing failed
 *   dependencies when any check fails. Used as the readiness probe so
 *   k8s won't route traffic to an instance whose DB is partitioned
 *   from it.
 *
 * Both endpoints are intentionally unauthenticated (no `Authorization`
 * header required) and bypass the rate limiter so orchestrators can
 * poll them cheaply. They are NOT exposed under `/api/v1` and don't
 * leak any user data — only the dependency status.
 */
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

interface DependencyStatus {
  name: string;
  ok: boolean;
  /** Optional diagnostic — typically the error message on failure. */
  detail?: string;
}

async function checkPrisma(app: FastifyInstance): Promise<DependencyStatus> {
  try {
    await app.prisma.$queryRaw`SELECT 1`;
    return { name: "postgres", ok: true };
  } catch (e) {
    return {
      name: "postgres",
      ok: false,
      detail: (e as Error).message.slice(0, 200),
    };
  }
}

async function checkClickHouse(
  app: FastifyInstance,
): Promise<DependencyStatus> {
  if (!app.clickhouse) {
    return { name: "clickhouse", ok: true, detail: "not configured (Prisma fallback)" };
  }
  try {
    const result = await app.clickhouse.ping();
    if (!result?.success) {
      return {
        name: "clickhouse",
        ok: false,
        detail: "ping returned unsuccessful result",
      };
    }
    return { name: "clickhouse", ok: true };
  } catch (e) {
    return {
      name: "clickhouse",
      ok: false,
      detail: (e as Error).message.slice(0, 200),
    };
  }
}

export const healthPlugin = fp(async (app: FastifyInstance) => {
  app.get("/healthz", async () => ({
    status: "ok",
    uptimeSec: Math.round(process.uptime()),
  }));

  app.get("/readyz", async (_req, reply) => {
    const checks = await Promise.all([
      checkPrisma(app),
      checkClickHouse(app),
    ]);
    const allOk = checks.every((c) => c.ok);
    reply.status(allOk ? 200 : 503);
    return {
      status: allOk ? "ready" : "degraded",
      checks,
    };
  });
});