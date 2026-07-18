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
    const run = await this.repository.findByRunId(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    return run;
  }

  async getById(id: string) {
    const run = await this.repository.findById(id);
    if (!run) {
      throw new Error(`Run not found: ${id}`);
    }
    return run;
  }

  async list(params: {
    projectId?: string;
    status?: string;
    limit: number;
    offset: number;
  }) {
    return this.repository.list(params);
  }

  async update(runId: string, data: UpdateRunInput) {
    return this.repository.updateByRunId(runId, data);
  }

  async finish(runId: string) {
    return this.repository.updateByRunId(runId, { status: "finished" });
  }
}
