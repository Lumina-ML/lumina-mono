import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  TimeSeriesQueryOptions,
  TimeSeriesRow,
  TimeSeriesStorage,
  TimeSeriesTable,
} from "../../core/storage/time-series-storage.js";
import { toDate, toDateOrNull } from "../../utils/date.js";


export class PrismaTimeSeriesStorage implements TimeSeriesStorage {
  constructor(private readonly prisma: PrismaClient) { }

  async insertBatch(table: TimeSeriesTable, rows: TimeSeriesRow[]): Promise<void> {
    if (rows.length === 0) return;

    switch (table) {
      case "log_line":
        await this.prisma.logLine.createMany({
          data: rows.map((r) => ({
            runId: String(r.runId),
            projectId: String(r.projectId),
            level: String(r.level ?? "INFO"),
            message: String(r.message),
            step: r.step == null ? null : Number(r.step),
            timestamp: toDate(r.timestamp),
          })),
        });
        break;
      case "system_metric":
        await this.prisma.systemMetric.createMany({
          data: rows.map((r) => ({
            runId: String(r.runId),
            projectId: String(r.projectId),
            key: String(r.key),
            step: Number(r.step ?? 0),
            value: Number(r.value),
            loggedAt: toDate(r.loggedAt),
          })),
        });
        break;
      case "trace":
        await this.prisma.trace.createMany({
          data: rows.map((r) => ({
            projectId: String(r.projectId),
            runId: r.runId == null ? null : String(r.runId),
            traceId: String(r.traceId),
            name: String(r.name),
            status: String(r.status ?? "ok") as any,
            latencyMs: r.latencyMs == null ? null : Number(r.latencyMs),
            metadata: (r.metadata as any) ?? {},
            startedAt: toDate(r.startedAt),
            finishedAt: toDateOrNull(r.finishedAt),
          })),
        });
        break;
      case "span":
        await this.prisma.span.createMany({
          data: rows.map((r) => ({
            traceId: String(r.traceId),
            parentSpanId: r.parentSpanId == null ? null : String(r.parentSpanId),
            spanId: String(r.spanId),
            name: String(r.name),
            kind: String(r.kind ?? "internal") as any,
            input: (r.input as any) ?? {},
            output: (r.output as any) ?? {},
            latencyMs: r.latencyMs == null ? null : Number(r.latencyMs),
            status: String(r.status ?? "ok") as any,
            startedAt: toDate(r.startedAt),
            finishedAt: toDateOrNull(r.finishedAt),
          })),
        });
        break;
      default:
        throw new Error(`Unsupported time series table: ${table}`);
    }
  }

  async query(table: TimeSeriesTable, options: TimeSeriesQueryOptions): Promise<TimeSeriesRow[]> {
    const model = this.modelForTable(table);
    const where: Record<string, unknown> = {};
    if (options.runId) where.runId = options.runId;
    if (options.projectId) where.projectId = options.projectId;

    const timestampColumn = table === "span" ? "startedAt" : "timestamp";
    const timeFilter: Record<string, Date> = {};
    if (options.start) timeFilter.gte = options.start;
    if (options.end) timeFilter.lte = options.end;
    if (Object.keys(timeFilter).length > 0) {
      where[timestampColumn] = timeFilter;
    }

    return (model as any).findMany({
      where,
      orderBy: options.orderBy
        ? { [options.orderBy.column]: options.orderBy.direction }
        : { [timestampColumn]: "desc" },
      take: options.limit,
    });
  }

  private modelForTable(table: TimeSeriesTable) {
    switch (table) {
      case "log_line":
        return this.prisma.logLine;
      case "system_metric":
        return this.prisma.systemMetric;
      case "trace":
        return this.prisma.trace;
      case "span":
        return this.prisma.span;
      default:
        throw new Error(`Unsupported time series table: ${table}`);
    }
  }
}
