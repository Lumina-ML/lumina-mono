import type { FastifyInstance } from "fastify";
import { TraceService } from "./service.js";
import { TraceHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";

export async function traceRoutes(app: FastifyInstance) {
  const traceService = new TraceService(app.traceStorage);
  const projectService = new ProjectService(app.prisma);
  const handler = new TraceHandler(traceService, projectService);

  app.post("/projects/:projectId/traces", handler.createTrace.bind(handler));
  app.get("/projects/:projectId/traces", handler.listTraces.bind(handler));
  app.get("/traces/:traceId", handler.getTrace.bind(handler));
  app.patch("/traces/:traceId", handler.patchTrace.bind(handler));
  app.post("/traces/:traceId/spans", handler.createSpan.bind(handler));
  app.get("/spans/:spanId", handler.getSpan.bind(handler));
  app.patch("/spans/:spanId", handler.patchSpan.bind(handler));
}