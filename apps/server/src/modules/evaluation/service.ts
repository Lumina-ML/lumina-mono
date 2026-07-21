import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { TOKENS } from "../../core/di/tokens.js";
import type {
  CreateEvaluationInput,
  CreateEvaluationResultInput,
  PatchEvaluationInput,
  ListEvaluationsQuery,
} from "./schema.js";
import { EvaluationRepository } from "./repository.js";

@injectable()
export class EvaluationService {
  private readonly repository: EvaluationRepository;

  constructor(@inject(TOKENS.PrismaClient) prisma: PrismaClient) {
    this.repository = new EvaluationRepository(prisma);
  }

  async createEvaluation(projectId: string, data: CreateEvaluationInput) {
    return this.repository.createEvaluation(projectId, data);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async listByProject(projectId: string) {
    return this.repository.listByProject(projectId);
  }

  async list(params: ListEvaluationsQuery & { workspaceId?: string }) {
    return this.repository.list(params);
  }

  async updateEvaluation(id: string, data: PatchEvaluationInput) {
    return this.repository.updateEvaluation(id, data);
  }

  async createResult(evaluationId: string, data: CreateEvaluationResultInput) {
    return this.repository.createResult(evaluationId, data);
  }

  async listResults(evaluationId: string) {
    const evaluation = await this.repository.findById(evaluationId);
    if (!evaluation) {
      return null;
    }
    return evaluation.results ?? [];
  }
}
