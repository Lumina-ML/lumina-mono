import type { FastifyInstance } from "fastify";
import { EvaluationService } from "./service.js";
import { EvaluationHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";

export async function evaluationRoutes(app: FastifyInstance) {
  const evaluationService = new EvaluationService(app.prisma);
  const projectService = new ProjectService(app.prisma);
  const handler = new EvaluationHandler(evaluationService, projectService);

  app.post("/projects/:projectId/evaluations", handler.createEvaluation.bind(handler));
  app.get("/projects/:projectId/evaluations", handler.listEvaluations.bind(handler));
  app.get("/evaluations/:evaluationId", handler.getEvaluation.bind(handler));
  app.patch("/evaluations/:evaluationId", handler.patchEvaluation.bind(handler));
  app.post("/evaluations/:evaluationId/results", handler.createResult.bind(handler));
  app.get("/evaluations/:evaluationId/results", handler.listResults.bind(handler));
}
