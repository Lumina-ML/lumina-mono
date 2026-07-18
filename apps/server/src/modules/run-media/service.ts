import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateRunMediaInput, ListRunMediaQuery } from "./schema.js";
import { RunMediaRepository } from "./repository.js";

export class RunMediaService {
  private readonly repository: RunMediaRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new RunMediaRepository(prisma);
  }

  async createRunMedia(projectId: string, data: CreateRunMediaInput) {
    return this.repository.createRunMedia(projectId, data);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async list(projectId: string, query: ListRunMediaQuery) {
    return this.repository.list({ projectId, ...query });
  }
}
