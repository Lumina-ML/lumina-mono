import type { FastifyInstance } from "fastify";
import fastify from "fastify";
import { MemoryMetricStorage } from "../../src/infra/memory/memory-metric-storage.js";
import { MemoryTimeSeriesStorage } from "../../src/infra/memory/memory-time-series-storage.js";
import { MemoryEventBus } from "../../src/infra/memory/memory-event-bus.js";
import { NoopCache } from "../../src/infra/noop/noop-cache.js";
import { NoopQueue } from "../../src/infra/noop/noop-queue.js";
import { NoopTelemetry } from "../../src/infra/noop/noop-telemetry.js";
import { LocalObjectStorage } from "../../src/infra/storage/local.js";
import type { ServerConfig } from "../../src/config/index.js";
import type { PrismaClient } from "../../src/generated/prisma/index.js";

export interface BuildTestAppOptions {
  /** Override the in-memory event bus (e.g. with a real Redis bus). */
  eventBus?: MemoryEventBus;
  /** Override the in-memory metric storage. */
  metricStorage?: MemoryMetricStorage;
  /** Override the in-memory time series storage. */
  timeSeriesStorage?: MemoryTimeSeriesStorage;
  /** Mock Prisma client; required for handlers that touch Postgres. */
  prisma?: Partial<PrismaClient> | (() => Partial<PrismaClient>);
  /** Default workspace seed behavior; defaults to no-op when prisma is mocked. */
  seedDefaultWorkspace?: boolean;
}

export const TEST_CONFIG: ServerConfig = {
  nodeEnv: "test",
  port: 0,
  host: "127.0.0.1",
  logLevel: "fatal",
  requestIdHeader: "X-Request-ID",
  metricsEnabled: false,
  metricsPath: "/metrics",
  databaseUrl: "postgresql://test:test@localhost:5432/test",
  storageType: "local",
  localStorageBaseUrl: "http://localhost:0",
  localStoragePath: "./tests/tmp-uploads",
  s3Bucket: "test-bucket",
  s3Region: "us-east-1",
  s3AccessKeyId: "",
  s3SecretAccessKey: "",
  s3ForcePathStyle: false,
  clickhouseDatabase: "default",
};

/**
 * Build a Fastify app for tests. Injects in-memory infra by default so the
 * app can boot without Postgres / Redis / ClickHouse. Tests that need a
 * real Postgres should pass their own PrismaClient.
 */
export async function buildTestApp(
  options: BuildTestAppOptions = {},
): Promise<FastifyInstance> {
  const app = fastify({ logger: false, genReqId: () => crypto.randomUUID() });

  app.decorate("config", TEST_CONFIG);

  // Decorate infra with in-memory defaults; tests may swap them out.
  const metricStorage = options.metricStorage ?? new MemoryMetricStorage();
  const timeSeriesStorage = options.timeSeriesStorage ?? new MemoryTimeSeriesStorage();
  const eventBus = options.eventBus ?? new MemoryEventBus();
  const cache = new NoopCache();
  const queue = new NoopQueue();
  const telemetry = new NoopTelemetry();
  const storage = new LocalObjectStorage({ baseUrl: TEST_CONFIG.localStorageBaseUrl, basePath: TEST_CONFIG.localStoragePath });

  const prisma = (typeof options.prisma === "function"
    ? options.prisma()
    : options.prisma ?? {}) as PrismaClient;

  app.decorate("prisma", prisma);
  app.decorate("metricStorage", metricStorage);
  app.decorate("timeSeriesStorage", timeSeriesStorage);
  app.decorate("eventBus", eventBus);
  app.decorate("cache", cache);
  app.decorate("queue", queue);
  app.decorate("telemetry", telemetry as never);
  app.decorate("storage", storage);
  app.decorate("realtime", { addConnection: () => {}, broadcast: () => {} } as never);

  // Default workspace seed only if the mock supports it.
  if (options.seedDefaultWorkspace !== false) {
    const w = (prisma as { workspace?: { upsert: (...args: unknown[]) => Promise<unknown> } }).workspace;
    if (w?.upsert) {
      await w.upsert({
        where: { id: "default" },
        create: { id: "default", name: "default", displayName: "Default Workspace" },
        update: {},
      });
    }
  }

  // Mock auth plugin: read Bearer token and attach a fake user if the prisma
  // mock can resolve users.
  app.decorateRequest("user", undefined);
  app.addHook("onRequest", async (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const apiKey = authHeader.slice("Bearer ".length).trim();
      const user = (prisma as { user?: { findUnique: (a: unknown) => Promise<unknown> } }).user;
      if (user?.findUnique) {
        const found = (await user.findUnique({
          where: { apiKey },
          select: { id: true, email: true, apiKey: true },
        })) as { id: string; email: string; apiKey: string | null } | null;
        if (found) req.user = found;
      }
    }
  });

  return app;
}