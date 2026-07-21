import type { FastifyInstance } from "fastify";
import { MetricService } from "./service.js";
import { MetricHandler } from "./handler.js";
import { RunService } from "../run/service.js";
import { container } from "../../core/di/container.js";

export async function metricRoutes(app: FastifyInstance) {
  const metricService = container.resolve(MetricService);
  const runService = container.resolve(RunService);
  const handler = new MetricHandler(metricService, runService);

  app.post("/runs/:runId/metrics", {
    config: { authz: { kind: "run", param: "runId" } },
  }, handler.log.bind(handler));
  app.get("/runs/:runId/metrics", {
    config: { authz: { kind: "run", param: "runId" } },
  }, handler.list.bind(handler));
  app.post("/runs/metrics", handler.compare.bind(handler));
}
