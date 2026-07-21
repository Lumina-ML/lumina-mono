import type { FastifyInstance } from "fastify";
import { RunService } from "../run/service.js";
import { ProjectService } from "../project/service.js";
import { PublicHandler } from "./handler.js";
import { container } from "../../core/di/container.js";

export async function publicRoutes(app: FastifyInstance) {
  const runService = container.resolve(RunService);
  const projectService = container.resolve(ProjectService);
  const handler = new PublicHandler(runService, projectService);

  app.get("/public/runs", handler.listRuns.bind(handler));
  app.get("/public/projects", handler.listProjects.bind(handler));
}