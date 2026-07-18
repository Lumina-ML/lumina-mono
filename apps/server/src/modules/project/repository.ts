import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateProjectInput } from "./schema.js";

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
}
