import type { ClickHouseClient } from "@clickhouse/client";
import type {
  MetricListOptions,
  MetricListResult,
  MetricRecord,
  MetricStorage,
} from "../../core/storage/metric-storage.js";

export class ClickHouseMetricStorage implements MetricStorage {
  constructor(private readonly client: ClickHouseClient) {}

  async insertMetrics(runId: string, projectId: string, metrics: MetricRecord[]): Promise<void> {
    if (metrics.length === 0) return;

    await this.client.insert({
      table: "metrics",
      values: metrics.map((m) => ({
        runId,
        projectId,
        key: m.key,
        step: m.step,
        value: m.value,
        metadata: JSON.stringify(m.metadata ?? {}),
        loggedAt: m.loggedAt ?? new Date(),
      })),
      format: "JSONEachRow",
    });
  }

  async listMetrics(runId: string, options: MetricListOptions): Promise<MetricListResult> {
    const keyFilter =
      options.keys && options.keys.length > 0
        ? `AND key IN (${options.keys.map((k) => `'${k.replace(/'/g, "\\'")}'`).join(",")})`
        : "";

    const result = await this.client.query({
      query: `
        SELECT key, step, value, loggedAt
        FROM metrics
        WHERE runId = {runId:String}
        ${keyFilter}
        ORDER BY key ASC, step ASC
        LIMIT {limit:UInt32}
      `,
      query_params: {
        runId,
        limit: options.limit,
      },
      format: "JSONEachRow",
    });

    const rows = await result.json<{
      key: string;
      step: number;
      value: number;
      loggedAt: string;
    }>();

    const grouped: MetricListResult["metrics"] = {};
    for (const row of rows) {
      if (!grouped[row.key]) grouped[row.key] = [];
      grouped[row.key].push({
        step: row.step,
        value: row.value,
        loggedAt: row.loggedAt,
      });
    }

    return { runId, metrics: grouped };
  }
}
