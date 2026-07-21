import type { FastifyInstance } from "fastify";
import { RunFileService } from "./service.js";
import { RunFileHandler } from "./handler.js";
import { RunService } from "../run/service.js";
import { container } from "../../core/di/container.js";

export async function runFileRoutes(app: FastifyInstance) {
  const fileService = container.resolve(RunFileService);
  const runService = container.resolve(RunService);
  const handler = new RunFileHandler(fileService, runService);

  app.post("/runs/:runId/files", handler.save.bind(handler));
  app.get("/runs/:runId/files", handler.list.bind(handler));
  app.get("/runs/:runId/file", handler.get.bind(handler));
}