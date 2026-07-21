import type { FastifyInstance } from "fastify";
import { TraceService } from "./service.js";
import { TraceHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";
import { container } from "../../core/di/container.js";

export async function traceRoutes(app: FastifyInstance) {
  const traceService = container.resolve(TraceService);
  const projectService = container.resolve(ProjectService);
  const handler = new TraceHandler(traceService, projectService);

  app.post("/projects/:projectId/traces", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.createTrace.bind(handler));
  app.get("/projects/:projectId/traces", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.listTraces.bind(handler));
  // Workspace-wide list. Accepts `projectId` / `limit` / `offset`.
  app.get("/traces", handler.listAllTraces.bind(handler));
  app.get("/traces/:traceId", {
    config: { authz: { kind: "trace", param: "traceId" } },
  }, handler.getTrace.bind(handler));
  app.patch("/traces/:traceId", {
    config: { authz: { kind: "trace", param: "traceId" } },
  }, handler.patchTrace.bind(handler));
  app.post("/traces/:traceId/spans", {
    config: { authz: { kind: "trace", param: "traceId" } },
  }, handler.createSpan.bind(handler));
  app.get("/traces/:traceId/spans", {
    config: { authz: { kind: "trace", param: "traceId" } },
  }, handler.listSpans.bind(handler));
  app.get("/spans/:spanId", {
    config: { authz: { kind: "span", param: "spanId" } },
  }, handler.getSpan.bind(handler));
  app.patch("/spans/:spanId", {
    config: { authz: { kind: "span", param: "spanId" } },
  }, handler.patchSpan.bind(handler));
}