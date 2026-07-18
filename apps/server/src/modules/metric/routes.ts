import type { FastifyInstance } from "fastify";
import { MetricService } from "./service.js";
import { MetricHandler } from "./handler.js";
import { RunService } from "../run/service.js";

export async function metricRoutes(app: FastifyInstance) {
  const metricService = new MetricService(app.prisma);
  const runService = new RunService(app.prisma);
  const handler = new MetricHandler(metricService, runService);

  app.post("/runs/:runId/metrics", handler.log.bind(handler));
  app.get("/runs/:runId/metrics", handler.list.bind(handler));
}
