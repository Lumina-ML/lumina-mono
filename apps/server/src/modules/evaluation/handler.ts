import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { EvaluationService } from "./service.js";
import {
  CreateEvaluationSchema,
  CreateEvaluationResultSchema,
  PatchEvaluationSchema,
} from "./schema.js";
import { ProjectService } from "../project/service.js";

const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
const EvaluationParamsSchema = z.object({ evaluationId: z.string().uuid() });

export class EvaluationHandler {
  constructor(
    private readonly evaluationService: EvaluationService,
    private readonly projectService: ProjectService,
  ) {}

  async createEvaluation(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const data = CreateEvaluationSchema.parse(req.body);
    const project = await this.projectService.findById(projectId);
    if (!project) {
      reply.status(404).send({ error: "Project not found" });
      return;
    }
    const evaluation = await this.evaluationService.createEvaluation(projectId, data);
    reply.status(201).send(evaluation);
  }

  async listEvaluations(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const evaluations = await this.evaluationService.listByProject(projectId);
    reply.send({ items: evaluations });
  }

  async getEvaluation(req: FastifyRequest, reply: FastifyReply) {
    const { evaluationId } = EvaluationParamsSchema.parse(req.params);
    const evaluation = await this.evaluationService.findById(evaluationId);
    if (!evaluation) {
      reply.status(404).send({ error: "Evaluation not found" });
      return;
    }
    reply.send(evaluation);
  }

  async patchEvaluation(req: FastifyRequest, reply: FastifyReply) {
    const { evaluationId } = EvaluationParamsSchema.parse(req.params);
    const data = PatchEvaluationSchema.parse(req.body);
    const evaluation = await this.evaluationService.updateEvaluation(evaluationId, data);
    reply.send(evaluation);
  }

  async createResult(req: FastifyRequest, reply: FastifyReply) {
    const { evaluationId } = EvaluationParamsSchema.parse(req.params);
    const data = CreateEvaluationResultSchema.parse(req.body);
    const result = await this.evaluationService.createResult(evaluationId, data);
    reply.status(201).send(result);
  }
}
