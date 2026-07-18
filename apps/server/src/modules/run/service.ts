import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateRunInput, UpdateRunInput } from "./schema.js";
import { RunRepository } from "./repository.js";

export class RunService {
  private readonly repository: RunRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new RunRepository(prisma);
  }

  async create(projectId: string, data: CreateRunInput) {
    return this.repository.create(projectId, data);
  }

  async getByRunId(runId: string) {
    return this.repository.findByRunId(runId);
  }

  async getById(id: string) {
    return this.repository.findById(id);
  }

  async list(params: {
    projectId?: string;
    status?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    limit: number;
    offset: number;
  }) {
    return this.repository.list(params);
  }

  async delete(runId: string) {
    return this.repository.deleteByRunId(runId);
  }

  async update(runId: string, data: UpdateRunInput) {
    return this.repository.updateByRunId(runId, data);
  }

  async finish(runId: string) {
    return this.repository.updateByRunId(runId, { status: "finished" });
  }
}
