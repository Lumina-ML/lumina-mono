import { inject, injectable } from "tsyringe";
import type { TimeSeriesStorage } from "../../core/storage/time-series-storage.js";
import { TOKENS } from "../../core/di/tokens.js";
import type { LogSystemMetricsInput } from "./schema.js";

@injectable()
export class SystemMetricService {
  constructor(@inject(TOKENS.TimeSeriesStorage) private readonly storage: TimeSeriesStorage) {}

  async log(runId: string, projectId: string, data: LogSystemMetricsInput) {
    const now = new Date();
    const rows = data.metrics.map((m) => ({
      runId,
      projectId,
      key: m.key,
      step: m.step,
      value: m.value,
      loggedAt: now,
    }));
    await this.storage.insertBatch("system_metric", rows);
  }

  async list(runId: string, params: { keys?: string[]; limit: number }) {
    const rows = await this.storage.query("system_metric", {
      runId,
      limit: params.limit,
    });

    const allowed = params.keys && params.keys.length > 0 ? new Set(params.keys) : null;
    const grouped: Record<
      string,
      Array<{ step: number; value: number; loggedAt: string }>
    > = {};
    for (const row of rows) {
      const key = String(row.key);
      if (allowed && !allowed.has(key)) continue;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        step: Number(row.step ?? 0),
        value: Number(row.value),
        loggedAt: (row.loggedAt instanceof Date ? row.loggedAt : new Date(row.loggedAt as string)).toISOString(),
      });
    }
    for (const arr of Object.values(grouped)) {
      arr.sort((a, b) => a.step - b.step);
    }
    return { runId, metrics: grouped };
  }
}