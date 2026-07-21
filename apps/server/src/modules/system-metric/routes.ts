import type { FastifyInstance } from "fastify";
import { SystemMetricService } from "./service.js";
import { SystemMetricHandler } from "./handler.js";
import { RunService } from "../run/service.js";
import { container } from "../../core/di/container.js";

export async function systemMetricRoutes(app: FastifyInstance) {
  const systemMetricService = container.resolve(SystemMetricService);
  const runService = container.resolve(RunService);
  const handler = new SystemMetricHandler(systemMetricService, runService);

  app.post("/runs/:runId/system-metrics", {
    config: { authz: { kind: "run", param: "runId" } },
  }, handler.log.bind(handler));
  app.get("/runs/:runId/system-metrics", {
    config: { authz: { kind: "run", param: "runId" } },
  }, handler.list.bind(handler));
}