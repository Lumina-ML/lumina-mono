import type { FastifyInstance } from "fastify";
import { RunService } from "./service.js";
import { RunHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";

export async function runRoutes(app: FastifyInstance) {
  const runService = new RunService(app.prisma);
  const projectService = new ProjectService(app.prisma);
  const handler = new RunHandler(runService, projectService);

  app.post("/runs", handler.create.bind(handler));
  app.get("/runs", handler.list.bind(handler));
  app.get("/runs/:id", handler.getById.bind(handler));
  app.patch("/runs/:id", handler.update.bind(handler));
  app.delete("/runs/:id", handler.delete.bind(handler));
}
