import type { FastifyInstance } from "fastify";
import { MetricService } from "./service.js";
import { MetricHandler } from "./handler.js";
import { RunService } from "../run/service.js";
import { PrismaMetricStorage } from "../../infra/prisma/prisma-metric-storage.js";

export async function metricRoutes(app: FastifyInstance) {
  const metricStorage = new PrismaMetricStorage(app.prisma);
  const metricService = new MetricService(metricStorage, app.eventBus);
  const runService = new RunService(app.prisma);
  const handler = new MetricHandler(metricService, runService);

  app.post("/runs/:runId/metrics", handler.log.bind(handler));
  app.get("/runs/:runId/metrics", handler.list.bind(handler));
}
