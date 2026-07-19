import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  TimeSeriesQueryOptions,
  TimeSeriesRow,
  TimeSeriesStorage,
  TimeSeriesTable,
} from "../../core/storage/time-series-storage.js";
import { toDate } from "../../utils/date.js";


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
      default:
        throw new Error(`Unsupported time series table: ${table}`);
    }
  }

  async query(table: TimeSeriesTable, options: TimeSeriesQueryOptions): Promise<TimeSeriesRow[]> {
    const model = this.modelForTable(table);
    const where: Record<string, unknown> = {};
    if (options.runId) where.runId = options.runId;
    if (options.projectId) where.projectId = options.projectId;

    const timestampColumn = this.timestampColumnFor(table);
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
      default:
        throw new Error(`Unsupported time series table: ${table}`);
    }
  }

  private timestampColumnFor(table: TimeSeriesTable): string {
    switch (table) {
      case "system_metric":
        return "loggedAt";
      case "log_line":
      default:
        return "timestamp";
    }
  }
}
