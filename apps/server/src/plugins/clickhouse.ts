import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ClickHouseClient } from "@clickhouse/client";
import type { MetricStorage } from "../core/storage/metric-storage.js";
import type { TimeSeriesStorage } from "../core/storage/time-series-storage.js";
import type { TraceStorage } from "../core/storage/trace-storage.js";
import {
  createClickHouseClient,
  setupClickHouseSchema,
  ClickHouseMetricStorage,
  ClickHouseTimeSeriesStorage,
  ClickHouseTraceStorage,
} from "../infra/index.js";
import { PrismaMetricStorage } from "../infra/index.js";
import { PrismaTimeSeriesStorage } from "../infra/index.js";
import { PrismaTraceStorage } from "../infra/index.js";

declare module "fastify" {
  interface FastifyInstance {
    clickhouse?: ClickHouseClient;
    metricStorage: MetricStorage;
    timeSeriesStorage: TimeSeriesStorage;
    traceStorage: TraceStorage;
  }
}

export const clickhousePlugin = fp(async (app: FastifyInstance) => {
  const { clickhouseUrl, clickhouseUser, clickhousePassword, clickhouseDatabase } = app.config;

  if (!clickhouseUrl) {
    app.log.info("CLICKHOUSE_URL not configured; using Prisma for metrics, time series and trace data");
    app.decorate("metricStorage", new PrismaMetricStorage(app.prisma));
    app.decorate("timeSeriesStorage", new PrismaTimeSeriesStorage(app.prisma));
    app.decorate("traceStorage", new PrismaTraceStorage(app.prisma));
    return;
  }

  app.log.info({ clickhouseUrl }, "initializing ClickHouse client");
  const clickhouseConfig = {
    url: clickhouseUrl,
    username: clickhouseUser,
    password: clickhousePassword,
    database: clickhouseDatabase,
  };
  const clickhouse = createClickHouseClient(clickhouseConfig);
  await setupClickHouseSchema(clickhouseConfig, clickhouse);

  app.decorate("clickhouse", clickhouse);
  app.decorate("metricStorage", new ClickHouseMetricStorage(clickhouse));
  app.decorate("timeSeriesStorage", new ClickHouseTimeSeriesStorage(clickhouse));
  app.decorate("traceStorage", new ClickHouseTraceStorage(clickhouse));

  app.addHook("onClose", async () => {
    await clickhouse.close();
  });
});