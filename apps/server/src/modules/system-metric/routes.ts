import type { FastifyInstance } from "fastify";
import { SystemMetricService } from "./service.js";
import { SystemMetricHandler } from "./handler.js";
import { RunService } from "../run/service.js";

export async function systemMetricRoutes(app: FastifyInstance) {
  const systemMetricService = new SystemMetricService(app.prisma);
  const runService = new RunService(app.prisma);
  const handler = new SystemMetricHandler(systemMetricService, runService);

  app.post("/runs/:runId/system-metrics", handler.log.bind(handler));
  app.get("/runs/:runId/system-metrics", handler.list.bind(handler));
}
