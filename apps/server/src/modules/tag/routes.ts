import type { FastifyInstance } from "fastify";
import { TagService } from "./service.js";
import { TagHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";
import { RunService } from "../run/service.js";
import { container } from "../../core/di/container.js";

export async function tagRoutes(app: FastifyInstance) {
  const tagService = container.resolve(TagService);
  const projectService = container.resolve(ProjectService);
  const runService = container.resolve(RunService);
  const handler = new TagHandler(tagService, projectService, runService);

  app.post("/projects/:projectId/tags", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.create.bind(handler));
  app.get("/projects/:projectId/tags", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.listByProject.bind(handler));
  app.post("/runs/:runId/tags", {
    config: { authz: { kind: "run", param: "runId" } },
  }, handler.attachToRun.bind(handler));
  app.get("/runs/:runId/tags", {
    config: { authz: { kind: "run", param: "runId" } },
  }, handler.listByRun.bind(handler));
  app.delete("/runs/:runId/tags/:tagId", {
    config: {
      authz: [
        { kind: "run", param: "runId" },
        { kind: "tag", param: "tagId" },
      ],
    },
  }, handler.detachFromRun.bind(handler));
}
