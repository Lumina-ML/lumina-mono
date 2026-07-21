import type { FastifyInstance } from "fastify";
import { RunMediaService } from "./service.js";
import { RunMediaHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";
import { container } from "../../core/di/container.js";

export async function runMediaRoutes(app: FastifyInstance) {
  const runMediaService = container.resolve(RunMediaService);
  const projectService = container.resolve(ProjectService);
  const handler = new RunMediaHandler(runMediaService, projectService);

  app.post("/projects/:projectId/run-media", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.createRunMedia.bind(handler));
  app.get("/projects/:projectId/run-media", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.listRunMedia.bind(handler));
  app.get("/run-media/:runMediaId", {
    config: { authz: { kind: "runMedia", param: "runMediaId" } },
  }, handler.getRunMedia.bind(handler));
}
