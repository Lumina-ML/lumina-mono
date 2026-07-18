import type { PrismaClient } from "../../generated/prisma/index.js";
import type { LogMetricsInput } from "./schema.js";
import { MetricRepository } from "./repository.js";

export class MetricService {
  private readonly repository: MetricRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new MetricRepository(prisma);
  }

  async log(runId: string, data: LogMetricsInput) {
    return this.repository.createMany(runId, data);
  }

  async list(runId: string, params: { keys?: string[]; limit: number }) {
    return this.repository.list(runId, params);
  }
}
