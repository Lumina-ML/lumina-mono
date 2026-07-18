import type { PrismaClient } from "../../generated/prisma/index.js";
import type { LogMetricsInput } from "./schema.js";

export class MetricRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMany(runId: string, projectId: string, data: LogMetricsInput) {
    const metrics = data.metrics.map((m) => ({
      runId,
      projectId,
      key: m.key,
      step: m.step,
      value: m.value,
    }));

    await this.prisma.metric.createMany({
      data: metrics,
      skipDuplicates: true,
    });
  }

  async list(runId: string, params: { keys?: string[]; limit: number }) {
    const where: Record<string, unknown> = { runId };
    if (params.keys && params.keys.length > 0) {
      where.key = { in: params.keys };
    }

    const metrics = await this.prisma.metric.findMany({
      where,
      orderBy: [{ key: "asc" }, { step: "asc" }],
      take: params.limit,
    });

    const grouped: Record<
      string,
      Array<{ step: number; value: number; loggedAt: string }>
    > = {};
    for (const m of metrics) {
      if (!grouped[m.key]) grouped[m.key] = [];
      grouped[m.key].push({
        step: m.step,
        value: m.value,
        loggedAt: m.loggedAt.toISOString(),
      });
    }

    return { runId, metrics: grouped };
  }
}
