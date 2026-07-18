import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateTagInput } from "./schema.js";
import { TagRepository } from "./repository.js";

export class TagService {
  private readonly repository: TagRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new TagRepository(prisma);
  }

  async create(projectId: string, data: CreateTagInput) {
    return this.repository.create(projectId, data);
  }

  async findOrCreate(projectId: string, data: CreateTagInput) {
    const existing = await this.repository.findByName(projectId, data.name);
    if (existing) return existing;
    return this.repository.create(projectId, data);
  }

  async listByProject(projectId: string) {
    return this.repository.listByProject(projectId);
  }

  async attachToRun(runId: string, tagId: string) {
    return this.repository.attachToRun(runId, tagId);
  }

  async attachToRunByName(runId: string, projectId: string, name: string, color?: string) {
    const tag = await this.findOrCreate(projectId, { name, color });
    return this.repository.attachToRun(runId, tag.id);
  }

  async listByRun(runId: string) {
    return this.repository.listByRun(runId);
  }

  async detachFromRun(runId: string, tagId: string) {
    return this.repository.detachFromRun(runId, tagId);
  }
}
