import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateSweepInput, UpdateSweepInput } from "./schema.js";

export class SweepRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(projectId: string, data: CreateSweepInput) {
    return this.prisma.sweep.create({
      data: {
        projectId,
        name: data.name,
        method: data.method,
        config: data.config as unknown as Record<string, never>,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.sweep.findUnique({
      where: { id },
      include: { runs: { orderBy: { createdAt: "desc" } } },
    });
  }

  async listByProject(projectId: string) {
    return this.prisma.sweep.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async update(id: string, data: UpdateSweepInput) {
    const updateData: Record<string, unknown> = {};
    if (data.state !== undefined) updateData.state = data.state;
    if (data.bestRunId !== undefined) updateData.bestRunId = data.bestRunId;
    if (data.config !== undefined) updateData.config = data.config as unknown as Record<string, never>;

    return this.prisma.sweep.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    await this.prisma.sweep.delete({ where: { id } });
  }
}
