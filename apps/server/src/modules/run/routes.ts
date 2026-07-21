import type { FastifyInstance } from "fastify";
import { RunService } from "./service.js";
import { RunHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";
import { container } from "../../core/di/container.js";

export async function runRoutes(app: FastifyInstance) {
  const runService = container.resolve(RunService);
  const projectService = container.resolve(ProjectService);
  const handler = new RunHandler(runService, projectService);

  app.post("/runs", handler.create.bind(handler));
  app.get("/runs", handler.list.bind(handler));
  app.get("/runs/:id", {
    config: { authz: { kind: "run", param: "id" } },
  }, handler.getById.bind(handler));
  app.patch("/runs/:id", {
    config: { authz: { kind: "run", param: "id" } },
  }, handler.update.bind(handler));
  app.delete("/runs/:id", {
    config: { authz: { kind: "run", param: "id" } },
  }, handler.delete.bind(handler));
}
