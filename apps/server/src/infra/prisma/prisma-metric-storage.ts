import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  MetricListOptions,
  MetricListResult,
  MetricRecord,
  MetricStorage,
} from "../../core/storage/metric-storage.js";

export class PrismaMetricStorage implements MetricStorage {
  constructor(private readonly prisma: PrismaClient) {}

  async insertMetrics(runId: string, projectId: string, metrics: MetricRecord[]): Promise<void> {
    if (metrics.length === 0) return;

    await this.prisma.metric.createMany({
      data: metrics.map((m) => ({
        runId,
        projectId,
        key: m.key,
        step: m.step,
        value: m.value,
        metadata: m.metadata ?? {},
        loggedAt: m.loggedAt ?? new Date(),
      })),
      skipDuplicates: true,
    });
  }

  async listMetrics(runId: string, options: MetricListOptions): Promise<MetricListResult> {
    const where: Record<string, unknown> = { runId };
    if (options.keys && options.keys.length > 0) {
      where.key = { in: options.keys };
    }

    const metrics = await this.prisma.metric.findMany({
      where,
      orderBy: [{ key: "asc" }, { step: "asc" }],
      take: options.limit,
    });

    const grouped: MetricListResult["metrics"] = {};
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
