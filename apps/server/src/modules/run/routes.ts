import type { FastifyInstance } from "fastify";
import { RunService } from "./service.js";
import { RunHandler } from "./handler.js";

export async function runRoutes(app: FastifyInstance) {
  const service = new RunService(app.prisma);
  const handler = new RunHandler(service);

  app.post("/runs", handler.create.bind(handler));
  app.get("/runs", handler.list.bind(handler));
  app.get("/runs/:id", handler.getById.bind(handler));
  app.patch("/runs/:id", handler.update.bind(handler));
}
