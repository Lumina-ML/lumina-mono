import type { PrismaClient } from "../../generated/prisma/index.js";
import type { LogSystemMetricsInput } from "./schema.js";
import { SystemMetricRepository } from "./repository.js";

export class SystemMetricService {
  private readonly repository: SystemMetricRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new SystemMetricRepository(prisma);
  }

  async log(runId: string, projectId: string, data: LogSystemMetricsInput) {
    return this.repository.createMany(runId, projectId, data);
  }

  async list(runId: string, params: { keys?: string[]; limit: number }) {
    return this.repository.list(runId, params);
  }
}
