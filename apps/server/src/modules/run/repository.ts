import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateRunInput, UpdateRunInput } from "./schema.js";
import { uuidv7 } from "../../shared/uuid7.js";

export class RunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(projectId: string, data: CreateRunInput) {
    const trimmed = data.name?.trim();
    const fallbackName = trimmed && trimmed.length > 0
      ? trimmed
      : `run-${Math.random().toString(16).slice(2, 10)}`;
    return this.prisma.run.create({
      data: {
        projectId,
        runId: uuidv7(),
        sweepId: data.sweepId,
        name: fallbackName,
        status: "running",
        config: data.config as any,
        metadata: data.metadata as any,
      },
    });
  }

  async findByRunId(runId: string) {
    return this.prisma.run.findUnique({
      where: { runId },
      include: { _count: { select: { metrics: true } } },
    });
  }

  async findById(id: string) {
    return this.prisma.run.findUnique({
      where: { id },
      include: { _count: { select: { metrics: true } } },
    });
  }

  async list(params: {
    projectId?: string;
    status?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    limit: number;
    offset: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.projectId) where.projectId = params.projectId;
    if (params.status) where.status = params.status;
    if (params.createdAfter || params.createdBefore) {
      where.createdAt = {};
      if (params.createdAfter) (where.createdAt as Record<string, Date>).gte = params.createdAfter;
      if (params.createdBefore) (where.createdAt as Record<string, Date>).lte = params.createdBefore;
    }

    const [items, total] = await Promise.all([
      this.prisma.run.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.run.count({ where }),
    ]);

    return { items, total };
  }

  async deleteByRunId(runId: string) {
    await this.prisma.run.delete({ where: { runId } });
  }

  async updateByRunId(runId: string, data: UpdateRunInput) {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (["finished", "failed", "crashed", "killed"].includes(data.status)) {
        updateData.finishedAt = new Date();
      }
    }
    if (data.config !== undefined) updateData.config = data.config as any;
    if (data.summary !== undefined) updateData.summary = data.summary as any;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as any;

    return this.prisma.run.update({
      where: { runId },
      data: updateData,
    });
  }
}
