import type {
  MetricListOptions,
  MetricListResult,
  MetricRecord,
  MetricStorage,
} from "../../core/storage/metric-storage.js";

/**
 * In-memory MetricStorage for tests and local development without
 * Postgres / ClickHouse. Matches the shape and ordering contract of
 * PrismaMetricStorage / ClickHouseMetricStorage (key asc, step asc).
 */
export class MemoryMetricStorage implements MetricStorage {
  private readonly records: Array<MetricRecord & { runId: string; projectId: string }> = [];

  async insertMetrics(runId: string, projectId: string, metrics: MetricRecord[]): Promise<void> {
    if (metrics.length === 0) return;
    for (const m of metrics) {
      this.records.push({
        runId,
        projectId,
        key: m.key,
        step: m.step,
        value: m.value,
        metadata: m.metadata,
        loggedAt: m.loggedAt ?? new Date(),
      });
    }
  }

  async listMetrics(runId: string, options: MetricListOptions): Promise<MetricListResult> {
    let filtered = this.records.filter((r) => r.runId === runId);
    if (options.keys && options.keys.length > 0) {
      const allowed = new Set(options.keys);
      filtered = filtered.filter((r) => allowed.has(r.key));
    }

    filtered.sort((a, b) => {
      if (a.key !== b.key) return a.key < b.key ? -1 : 1;
      return a.step - b.step;
    });

    const grouped: MetricListResult["metrics"] = {};
    for (const r of filtered.slice(0, options.limit)) {
      if (!grouped[r.key]) grouped[r.key] = [];
      grouped[r.key].push({
        step: r.step,
        value: r.value,
        loggedAt: (r.loggedAt ?? new Date()).toISOString(),
      });
    }
    return { runId, metrics: grouped };
  }

  /** Test helper: clear all records. */
  reset(): void {
    this.records.length = 0;
  }
}