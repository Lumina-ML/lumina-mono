import type { ClickHouseClient } from "@clickhouse/client";
import type {
  TimeSeriesQueryOptions,
  TimeSeriesRow,
  TimeSeriesStorage,
  TimeSeriesTable,
} from "../../core/storage/time-series-storage.js";

const TABLE_MAP: Record<TimeSeriesTable, string> = {
  log_line: "log_lines",
  system_metric: "system_metrics",
  trace: "traces",
  span: "spans",
};

const TIMESTAMP_COLUMN_MAP: Record<TimeSeriesTable, string> = {
  log_line: "timestamp",
  system_metric: "loggedAt",
  trace: "startedAt",
  span: "startedAt",
};

export class ClickHouseTimeSeriesStorage implements TimeSeriesStorage {
  constructor(private readonly client: ClickHouseClient) {}

  async insertBatch(table: TimeSeriesTable, rows: TimeSeriesRow[]): Promise<void> {
    if (rows.length === 0) return;

    const clickhouseTable = TABLE_MAP[table];
    const values = rows.map((r) => this.normalizeRow(table, r));

    await this.client.insert({
      table: clickhouseTable,
      values,
      format: "JSONEachRow",
    });
  }

  async query(table: TimeSeriesTable, options: TimeSeriesQueryOptions): Promise<TimeSeriesRow[]> {
    const clickhouseTable = TABLE_MAP[table];
    const timestampColumn = TIMESTAMP_COLUMN_MAP[table];

    const conditions: string[] = [];
    const params: Record<string, unknown> = { limit: options.limit };

    if (options.runId) {
      conditions.push(`runId = {runId:String}`);
      params.runId = options.runId;
    }
    if (options.projectId) {
      conditions.push(`projectId = {projectId:String}`);
      params.projectId = options.projectId;
    }
    if (options.start) {
      conditions.push(`${timestampColumn} >= {start:String}`);
      params.start = options.start.toISOString();
    }
    if (options.end) {
      conditions.push(`${timestampColumn} <= {end:String}`);
      params.end = options.end.toISOString();
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderClause = options.orderBy
      ? `ORDER BY ${options.orderBy.column} ${options.orderBy.direction.toUpperCase()}`
      : `ORDER BY ${timestampColumn} DESC`;

    const result = await this.client.query({
      query: `
        SELECT *
        FROM ${clickhouseTable}
        ${whereClause}
        ${orderClause}
        LIMIT {limit:UInt32}
      `,
      query_params: params,
      format: "JSONEachRow",
    });

    return result.json<TimeSeriesRow>();
  }

  private normalizeRow(table: TimeSeriesTable, r: TimeSeriesRow): TimeSeriesRow {
    switch (table) {
      case "log_line":
        return {
          runId: String(r.runId),
          projectId: String(r.projectId),
          level: String(r.level ?? "INFO"),
          message: String(r.message),
          step: r.step == null ? null : Number(r.step),
          timestamp: r.timestamp ? new Date(r.timestamp as string | number | Date) : new Date(),
        };
      case "system_metric":
        return {
          runId: String(r.runId),
          projectId: String(r.projectId),
          key: String(r.key),
          step: Number(r.step ?? 0),
          value: Number(r.value),
          loggedAt: r.loggedAt ? new Date(r.loggedAt as string | number | Date) : new Date(),
        };
      case "trace":
        return {
          projectId: String(r.projectId),
          runId: r.runId == null ? null : String(r.runId),
          traceId: String(r.traceId),
          name: String(r.name),
          status: String(r.status ?? "ok"),
          latencyMs: r.latencyMs == null ? null : Number(r.latencyMs),
          metadata: JSON.stringify(r.metadata ?? {}),
          startedAt: r.startedAt ? new Date(r.startedAt as string | number | Date) : new Date(),
          finishedAt: r.finishedAt ? new Date(r.finishedAt as string | number | Date) : null,
        };
      case "span":
        return {
          traceId: String(r.traceId),
          parentSpanId: r.parentSpanId == null ? null : String(r.parentSpanId),
          spanId: String(r.spanId),
          name: String(r.name),
          kind: String(r.kind ?? "internal"),
          input: JSON.stringify(r.input ?? {}),
          output: JSON.stringify(r.output ?? {}),
          latencyMs: r.latencyMs == null ? null : Number(r.latencyMs),
          status: String(r.status ?? "ok"),
          startedAt: r.startedAt ? new Date(r.startedAt as string | number | Date) : new Date(),
          finishedAt: r.finishedAt ? new Date(r.finishedAt as string | number | Date) : null,
        };
      default:
        return r;
    }
  }
}
