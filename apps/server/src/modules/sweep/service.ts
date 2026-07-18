import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateSweepInput, UpdateSweepInput } from "./schema.js";
import { SweepRepository } from "./repository.js";

export class SweepService {
  private readonly repository: SweepRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new SweepRepository(prisma);
  }

  async create(projectId: string, data: CreateSweepInput) {
    return this.repository.create(projectId, data);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async listByProject(projectId: string) {
    return this.repository.listByProject(projectId);
  }

  async update(id: string, data: UpdateSweepInput) {
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    return this.repository.delete(id);
  }
}
