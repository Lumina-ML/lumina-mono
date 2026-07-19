import type { FastifyInstance } from "fastify";
import { RunFileService } from "./service.js";
import { RunFileHandler } from "./handler.js";
import { RunService } from "../run/service.js";

export async function runFileRoutes(app: FastifyInstance) {
  const fileService = new RunFileService(app.prisma, app.storage);
  const runService = new RunService(app.prisma);
  const handler = new RunFileHandler(fileService, runService);

  app.post("/runs/:runId/files", handler.save.bind(handler));
  app.get("/runs/:runId/files", handler.list.bind(handler));
  app.get("/runs/:runId/file", handler.get.bind(handler));
}