import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateTagInput } from "./schema.js";

export class TagRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(projectId: string, data: CreateTagInput) {
    return this.prisma.tag.create({
      data: { projectId, name: data.name, color: data.color },
    });
  }

  async findByName(projectId: string, name: string) {
    return this.prisma.tag.findUnique({
      where: { projectId_name: { projectId, name } },
    });
  }

  async findById(id: string) {
    return this.prisma.tag.findUnique({ where: { id } });
  }

  async listByProject(projectId: string) {
    return this.prisma.tag.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async attachToRun(runId: string, tagId: string) {
    return this.prisma.runTag.upsert({
      where: { runId_tagId: { runId, tagId } },
      create: { runId, tagId },
      update: {},
    });
  }

  async listByRun(runId: string) {
    const runTags = await this.prisma.runTag.findMany({
      where: { runId },
      include: { tag: true },
      orderBy: { tag: { createdAt: "desc" } },
    });
    return runTags.map((rt) => rt.tag);
  }

  async detachFromRun(runId: string, tagId: string) {
    await this.prisma.runTag.delete({
      where: { runId_tagId: { runId, tagId } },
    });
  }
}
