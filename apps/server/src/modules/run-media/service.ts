import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { TOKENS } from "../../core/di/tokens.js";
import type { CreateRunMediaInput, ListRunMediaQuery } from "./schema.js";
import { RunMediaRepository } from "./repository.js";

@injectable()
export class RunMediaService {
  private readonly repository: RunMediaRepository;

  constructor(@inject(TOKENS.PrismaClient) prisma: PrismaClient) {
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
