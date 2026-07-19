import type { FastifyInstance } from "fastify";
import { ProjectService } from "./service.js";
import { ProjectHandler } from "./handler.js";

export async function projectRoutes(app: FastifyInstance) {
  const service = new ProjectService(app.prisma);
  const handler = new ProjectHandler(service);

  app.post("/projects", handler.create.bind(handler));
  app.get("/projects", handler.list.bind(handler));
  app.get("/projects/:id", {
    config: { authz: { kind: "project", param: "id" } },
  }, handler.getById.bind(handler));
  app.patch("/projects/:id", {
    config: { authz: { kind: "project", param: "id" } },
  }, handler.update.bind(handler));
  app.delete("/projects/:id", {
    config: { authz: { kind: "project", param: "id" } },
  }, handler.delete.bind(handler));
}
