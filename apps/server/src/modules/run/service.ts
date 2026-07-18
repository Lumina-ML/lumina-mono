import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateRunInput, UpdateRunInput } from "./schema.js";
import { RunRepository } from "./repository.js";

export class RunService {
  private readonly repository: RunRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new RunRepository(prisma);
  }

  async create(data: CreateRunInput) {
    return this.repository.create(data);
  }

  async getById(id: string) {
    const run = await this.repository.findById(id);
    if (!run) {
      throw new Error(`Run not found: ${id}`);
    }
    return run;
  }

  async list(params: {
    project?: string;
    status?: string;
    limit: number;
    offset: number;
  }) {
    return this.repository.list(params);
  }

  async update(id: string, data: UpdateRunInput) {
    return this.repository.update(id, data);
  }

  async finish(id: string) {
    return this.repository.update(id, { status: "finished" });
  }
}
