import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { EvaluationService } from "./service.js";
import {
  CreateEvaluationSchema,
  CreateEvaluationResultSchema,
  PatchEvaluationSchema,
  ListEvaluationsQuerySchema,
} from "./schema.js";
import { ProjectService } from "../project/service.js";
import {
  assertOwnsEvaluation,
  assertOwnsProject,
} from "../../core/authz/assert-workspace.js";

const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
const EvaluationParamsSchema = z.object({ evaluationId: z.string().uuid() });

export class EvaluationHandler {
  constructor(
    private readonly evaluationService: EvaluationService,
    private readonly projectService: ProjectService,
  ) {}

  async createEvaluation(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    if (!(await assertOwnsProject(req.server.prisma, req, reply, projectId))) return;
    const data = CreateEvaluationSchema.parse(req.body);
    const evaluation = await this.evaluationService.createEvaluation(projectId, data);
    reply.status(201).send(evaluation);
  }

  async listEvaluations(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    if (!(await assertOwnsProject(req.server.prisma, req, reply, projectId))) return;
    const evaluations = await this.evaluationService.listByProject(projectId);
    reply.send({ items: evaluations });
  }

  /**
   * Workspace-wide evaluation list. Backed by `GET /evaluations`. Returns
   * the same `{ items, total }` shape used by `/runs` and `/projects`, but
   * without the heavy nested `include` from `listByProject` (detail routes
   * still return that). Always scoped to the requestor's workspace.
   */
  async listAllEvaluations(req: FastifyRequest, reply: FastifyReply) {
    const query = ListEvaluationsQuerySchema.parse(req.query);
    const result = await this.evaluationService.list({
      ...query,
      workspaceId: req.workspaceId,
    });
    reply.send(result);
  }

  async getEvaluation(req: FastifyRequest, reply: FastifyReply) {
    const { evaluationId } = EvaluationParamsSchema.parse(req.params);
    if (!(await assertOwnsEvaluation(req.server.prisma, req, reply, evaluationId))) return;
    const evaluation = await this.evaluationService.findById(evaluationId);
    if (!evaluation) {
      reply.status(404).send({ error: "Evaluation not found" });
      return;
    }
    reply.send(evaluation);
  }

  async patchEvaluation(req: FastifyRequest, reply: FastifyReply) {
    const { evaluationId } = EvaluationParamsSchema.parse(req.params);
    if (!(await assertOwnsEvaluation(req.server.prisma, req, reply, evaluationId))) return;
    const data = PatchEvaluationSchema.parse(req.body);
    const evaluation = await this.evaluationService.updateEvaluation(evaluationId, data);
    reply.send(evaluation);
  }

  async createResult(req: FastifyRequest, reply: FastifyReply) {
    const { evaluationId } = EvaluationParamsSchema.parse(req.params);
    if (!(await assertOwnsEvaluation(req.server.prisma, req, reply, evaluationId))) return;
    const data = CreateEvaluationResultSchema.parse(req.body);
    const result = await this.evaluationService.createResult(evaluationId, data);
    reply.status(201).send(result);
  }

  async listResults(req: FastifyRequest, reply: FastifyReply) {
    const { evaluationId } = EvaluationParamsSchema.parse(req.params);
    if (!(await assertOwnsEvaluation(req.server.prisma, req, reply, evaluationId))) return;
    const results = await this.evaluationService.listResults(evaluationId);
    if (results === null) {
      reply.status(404).send({ error: "Evaluation not found" });
      return;
    }
    reply.send({ items: results });
  }
}
