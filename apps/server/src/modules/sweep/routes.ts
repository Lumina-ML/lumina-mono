import type { FastifyInstance } from "fastify";
import { SweepService } from "./service.js";
import { SweepHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";
import { RunService } from "../run/service.js";

export async function sweepRoutes(app: FastifyInstance) {
  const sweepService = new SweepService(app.prisma);
  const projectService = new ProjectService(app.prisma);
  const runService = new RunService(app.prisma);
  const handler = new SweepHandler(sweepService, projectService, runService);

  app.post("/projects/:projectId/sweeps", handler.create.bind(handler));
  app.get("/projects/:projectId/sweeps", handler.list.bind(handler));
  app.get("/sweeps/:sweepId", handler.getById.bind(handler));
  app.patch("/sweeps/:sweepId", handler.update.bind(handler));
  app.delete("/sweeps/:sweepId", handler.delete.bind(handler));
}
