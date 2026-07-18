import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateRunInput, UpdateRunInput } from "./schema.js";

export class RunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateRunInput) {
    return this.prisma.run.create({
      data: {
        project: data.project,
        name: data.name,
        config: data.config as any,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.run.findUnique({
      where: { id },
      include: { _count: { select: { metrics: true } } },
    });
  }

  async list(params: {
    project?: string;
    status?: string;
    limit: number;
    offset: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.project) where.project = params.project;
    if (params.status) where.status = params.status;

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

  async update(id: string, data: UpdateRunInput) {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "finished") {
        updateData.finishedAt = new Date();
      }
    }
    if (data.config !== undefined) updateData.config = data.config as any;

    return this.prisma.run.update({
      where: { id },
      data: updateData,
    });
  }
}
