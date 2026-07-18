import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ClickHouseClient } from "@clickhouse/client";
import type { MetricStorage } from "../core/storage/metric-storage.js";
import type { TimeSeriesStorage } from "../core/storage/time-series-storage.js";
import {
  createClickHouseClient,
  setupClickHouseSchema,
  ClickHouseMetricStorage,
  ClickHouseTimeSeriesStorage,
} from "../infra/index.js";
import { PrismaMetricStorage } from "../infra/index.js";
import { PrismaTimeSeriesStorage } from "../infra/index.js";

declare module "fastify" {
  interface FastifyInstance {
    clickhouse?: ClickHouseClient;
    metricStorage: MetricStorage;
    timeSeriesStorage: TimeSeriesStorage;
  }
}

export const clickhousePlugin = fp(async (app: FastifyInstance) => {
  const { clickhouseUrl } = app.config;

  if (!clickhouseUrl) {
    app.log.info("CLICKHOUSE_URL not configured; using Prisma for metrics and time series data");
    app.decorate("metricStorage", new PrismaMetricStorage(app.prisma));
    app.decorate("timeSeriesStorage", new PrismaTimeSeriesStorage(app.prisma));
    return;
  }

  app.log.info({ clickhouseUrl }, "initializing ClickHouse client");
  const clickhouse = createClickHouseClient({ url: clickhouseUrl });
  await setupClickHouseSchema(clickhouse);

  app.decorate("clickhouse", clickhouse);
  app.decorate("metricStorage", new ClickHouseMetricStorage(clickhouse));
  app.decorate("timeSeriesStorage", new ClickHouseTimeSeriesStorage(clickhouse));

  app.addHook("onClose", async () => {
    await clickhouse.close();
  });
});
