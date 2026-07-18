import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateProjectInput, UpdateProjectInput } from "./schema.js";

export class ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(workspaceId: string, data: CreateProjectInput) {
    return this.prisma.project.create({
      data: {
        workspaceId,
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        settings: (data.settings ?? {}) as Record<string, never>,
      },
    });
  }

  async findByName(workspaceId: string, name: string) {
    return this.prisma.project.findUnique({
      where: { workspaceId_name: { workspaceId, name } },
    });
  }

  async findOrCreate(workspaceId: string, data: CreateProjectInput) {
    const existing = await this.findByName(workspaceId, data.name);
    if (existing) return existing;
    return this.create(workspaceId, data);
  }

  async findById(id: string) {
    return this.prisma.project.findUnique({ where: { id } });
  }

  async list(workspaceId: string, params: { limit: number; offset: number }) {
    const where = { workspaceId };
    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.project.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: UpdateProjectInput) {
    return this.prisma.project.update({
      where: { id },
      data: {
        displayName: data.displayName,
        description: data.description,
        settings: data.settings as Record<string, never> | undefined,
      },
    });
  }

  async delete(id: string) {
    await this.prisma.project.delete({ where: { id } });
  }
}
