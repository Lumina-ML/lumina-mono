import fastify from "fastify";
import { configPlugin } from "./plugins/config.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { clickhousePlugin } from "./plugins/clickhouse.js";
import { storagePlugin } from "./plugins/storage.js";
import { telemetryPlugin } from "./plugins/telemetry.js";
import { busPlugin } from "./plugins/bus.js";
import { cachePlugin } from "./plugins/cache.js";
import { queuePlugin } from "./plugins/queue.js";
import { createJobWorker } from "./jobs/worker.js";
import type { JobContext } from "./jobs/types.js";

async function buildWorker() {
  const app = fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  });

  await app.register(configPlugin);
  await app.register(prismaPlugin);
  await app.register(clickhousePlugin);
  await app.register(storagePlugin);
  await app.register(telemetryPlugin);
  await app.register(busPlugin);
  await app.register(cachePlugin);
  await app.register(queuePlugin);

  // Subscribe to domain events for real-time / in-process side effects.
  app.eventBus.subscribe("MetricLogged", async (event) => {
    app.log.info(
      { runId: event.payload.runId, keys: event.payload.keys, count: event.payload.count },
      "worker received MetricLogged",
    );
  });

  app.eventBus.subscribe("RunFinished", async (event) => {
    app.log.info(
      { runId: event.payload.runId, status: event.payload.status },
      "worker received RunFinished",
    );
  });

  // Start durable job worker when Redis is available.
  let jobWorker: ReturnType<typeof createJobWorker> | undefined;
  if (app.config.redisUrl) {
    const ctx: JobContext = {
      prisma: app.prisma,
      metricStorage: app.metricStorage,
      timeSeriesStorage: app.timeSeriesStorage,
      cache: app.cache,
    };
    jobWorker = createJobWorker({ redisUrl: app.config.redisUrl, ctx });
    app.log.info({ redisUrl: app.config.redisUrl }, "started BullMQ job worker");
  }

  app.addHook("onClose", async () => {
    if (jobWorker) {
      await jobWorker.close();
    }
  });

  return app;
}

const app = await buildWorker();
app.log.info("Lumina worker started");

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "received shutdown signal, closing worker...");
  try {
    await app.close();
    app.log.info("worker closed gracefully");
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
