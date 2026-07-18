import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateEvaluationInput,
  CreateEvaluationResultInput,
  PatchEvaluationInput,
} from "./schema.js";

export class EvaluationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createEvaluation(projectId: string, data: CreateEvaluationInput) {
    return this.prisma.evaluation.create({
      data: {
        projectId,
        name: data.name,
        runId: data.runId,
        datasetArtifactVersionId: data.datasetArtifactVersionId,
        modelArtifactVersionId: data.modelArtifactVersionId,
        status: "pending",
        metadata: data.metadata as Record<string, never>,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.evaluation.findUnique({
      where: { id },
      include: {
        results: { orderBy: { createdAt: "desc" } },
        datasetArtifactVersion: { include: { artifact: true } },
        modelArtifactVersion: { include: { artifact: true } },
      },
    });
  }

  async listByProject(projectId: string) {
    return this.prisma.evaluation.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        results: { orderBy: { createdAt: "desc" } },
        datasetArtifactVersion: { include: { artifact: true } },
        modelArtifactVersion: { include: { artifact: true } },
      },
    });
  }

  async updateEvaluation(id: string, data: PatchEvaluationInput) {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (["completed", "failed"].includes(data.status)) {
        updateData.updatedAt = new Date();
      }
    }
    if (data.summary !== undefined) updateData.summary = data.summary as Record<string, never>;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as Record<string, never>;

    return this.prisma.evaluation.update({
      where: { id },
      data: updateData,
    });
  }

  async createResult(evaluationId: string, data: CreateEvaluationResultInput) {
    return this.prisma.evaluationResult.create({
      data: {
        evaluationId,
        key: data.key,
        value: data.value,
        metadata: data.metadata as Record<string, never>,
      },
    });
  }
}
