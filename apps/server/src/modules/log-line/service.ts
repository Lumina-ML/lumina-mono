import type { PrismaClient } from "../../generated/prisma/index.js";
import type { LogLinesInput } from "./schema.js";
import { LogLineRepository } from "./repository.js";

export class LogLineService {
  private readonly repository: LogLineRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new LogLineRepository(prisma);
  }

  async log(runId: string, projectId: string, data: LogLinesInput) {
    return this.repository.createMany(runId, projectId, data);
  }

  async list(runId: string, params: { level?: string; limit: number }) {
    return this.repository.list(runId, params);
  }
}
