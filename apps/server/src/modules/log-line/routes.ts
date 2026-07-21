import type { FastifyInstance } from "fastify";
import { LogLineService } from "./service.js";
import { LogLineHandler } from "./handler.js";
import { RunService } from "../run/service.js";
import { container } from "../../core/di/container.js";

export async function logLineRoutes(app: FastifyInstance) {
  const logLineService = container.resolve(LogLineService);
  const runService = container.resolve(RunService);
  const handler = new LogLineHandler(logLineService, runService);

  app.post("/runs/:runId/logs", {
    config: { authz: { kind: "run", param: "runId" } },
  }, handler.log.bind(handler));
  app.get("/runs/:runId/logs", {
    config: { authz: { kind: "run", param: "runId" } },
  }, handler.list.bind(handler));
}