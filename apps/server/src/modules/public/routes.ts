import type { FastifyInstance } from "fastify";
import { RunService } from "../run/service.js";
import { ProjectService } from "../project/service.js";
import { PublicHandler } from "./handler.js";

export async function publicRoutes(app: FastifyInstance) {
  const runService = new RunService(app.prisma, app.eventBus);
  const projectService = new ProjectService(app.prisma);
  const handler = new PublicHandler(runService, projectService);

  app.get("/public/runs", handler.listRuns.bind(handler));
  app.get("/public/projects", handler.listProjects.bind(handler));
}