import type { FastifyInstance } from "fastify";
import { LogLineService } from "./service.js";
import { LogLineHandler } from "./handler.js";
import { RunService } from "../run/service.js";

export async function logLineRoutes(app: FastifyInstance) {
  const logLineService = new LogLineService(app.timeSeriesStorage);
  const runService = new RunService(app.prisma);
  const handler = new LogLineHandler(logLineService, runService);

  app.post("/runs/:runId/logs", handler.log.bind(handler));
  app.get("/runs/:runId/logs", handler.list.bind(handler));
}