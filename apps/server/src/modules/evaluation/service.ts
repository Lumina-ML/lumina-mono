import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateEvaluationInput,
  CreateEvaluationResultInput,
  PatchEvaluationInput,
} from "./schema.js";
import { EvaluationRepository } from "./repository.js";

export class EvaluationService {
  private readonly repository: EvaluationRepository;

  constructor(prisma: PrismaClient) {
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

  async updateEvaluation(id: string, data: PatchEvaluationInput) {
    return this.repository.updateEvaluation(id, data);
  }

  async createResult(evaluationId: string, data: CreateEvaluationResultInput) {
    return this.repository.createResult(evaluationId, data);
  }
}
