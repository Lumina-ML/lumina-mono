import type { FastifyInstance } from "fastify";
import { EvaluationService } from "./service.js";
import { EvaluationHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";

export async function evaluationRoutes(app: FastifyInstance) {
  const evaluationService = new EvaluationService(app.prisma);
  const projectService = new ProjectService(app.prisma);
  const handler = new EvaluationHandler(evaluationService, projectService);

  app.post("/projects/:projectId/evaluations", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.createEvaluation.bind(handler));
  app.get("/projects/:projectId/evaluations", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.listEvaluations.bind(handler));
  // Workspace-wide list. Accepts `projectId` / `limit` / `offset`.
  app.get("/evaluations", handler.listAllEvaluations.bind(handler));
  app.get("/evaluations/:evaluationId", {
    config: { authz: { kind: "evaluation", param: "evaluationId" } },
  }, handler.getEvaluation.bind(handler));
  app.patch("/evaluations/:evaluationId", {
    config: { authz: { kind: "evaluation", param: "evaluationId" } },
  }, handler.patchEvaluation.bind(handler));
  app.post("/evaluations/:evaluationId/results", {
    config: { authz: { kind: "evaluation", param: "evaluationId" } },
  }, handler.createResult.bind(handler));
  app.get("/evaluations/:evaluationId/results", {
    config: { authz: { kind: "evaluation", param: "evaluationId" } },
  }, handler.listResults.bind(handler));
}
