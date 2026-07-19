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

  app.post("/projects/:projectId/sweeps", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.create.bind(handler));
  app.get("/projects/:projectId/sweeps", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.list.bind(handler));
  // Workspace-wide list. Accepts `projectId` / `limit` / `offset`.
  app.get("/sweeps", handler.listAll.bind(handler));
  app.get("/sweeps/:sweepId", {
    config: { authz: { kind: "sweep", param: "sweepId" } },
  }, handler.getById.bind(handler));
  app.patch("/sweeps/:sweepId", {
    config: { authz: { kind: "sweep", param: "sweepId" } },
  }, handler.update.bind(handler));
  app.delete("/sweeps/:sweepId", {
    config: { authz: { kind: "sweep", param: "sweepId" } },
  }, handler.delete.bind(handler));

  app.get("/sweeps/:sweepId/observations", {
    config: { authz: { kind: "sweep", param: "sweepId" } },
  }, handler.listObservations.bind(handler));
  app.post("/sweeps/:sweepId/suggest", {
    config: { authz: { kind: "sweep", param: "sweepId" } },
  }, handler.suggest.bind(handler));
  app.post("/sweeps/:sweepId/should-terminate", {
    config: { authz: { kind: "sweep", param: "sweepId" } },
  }, handler.shouldTerminate.bind(handler));
  app.post("/sweeps/:sweepId/record-best", {
    config: { authz: { kind: "sweep", param: "sweepId" } },
  }, handler.recordBestRun.bind(handler));
}