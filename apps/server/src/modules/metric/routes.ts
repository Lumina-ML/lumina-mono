import type { FastifyInstance } from "fastify";
import { MetricService } from "./service.js";
import { MetricHandler } from "./handler.js";

export async function metricRoutes(app: FastifyInstance) {
  const service = new MetricService(app.prisma);
  const handler = new MetricHandler(service);

  app.post("/runs/:runId/metrics", handler.log.bind(handler));
  app.get("/runs/:runId/metrics", handler.list.bind(handler));
}
