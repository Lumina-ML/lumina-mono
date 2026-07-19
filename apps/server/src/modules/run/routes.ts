import type { FastifyInstance } from "fastify";
import { RunService } from "./service.js";
import { RunHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";

export async function runRoutes(app: FastifyInstance) {
  const runService = new RunService(
    app.prisma,
    app.eventBus,
    app.config.defaultWorkspaceId,
  );
  const projectService = new ProjectService(app.prisma);
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
