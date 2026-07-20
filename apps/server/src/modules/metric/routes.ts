import type { FastifyInstance } from "fastify";
import { MetricService } from "./service.js";
import { MetricHandler } from "./handler.js";
import { RunService } from "../run/service.js";

export async function metricRoutes(app: FastifyInstance) {
  const metricService = new MetricService(app.metricStorage, app.eventBus, app.queue);
  const runService = new RunService(app.prisma);
  const handler = new MetricHandler(metricService, runService);

  app.post("/runs/:runId/metrics", {
    config: { authz: { kind: "run", param: "runId" } },
  }, handler.log.bind(handler));
  app.get("/runs/:runId/metrics", {
    config: { authz: { kind: "run", param: "runId" } },
  }, handler.list.bind(handler));
  app.post("/runs/metrics", handler.compare.bind(handler));
}
