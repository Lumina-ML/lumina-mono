import type {
  TimeSeriesQueryOptions,
  TimeSeriesRow,
  TimeSeriesStorage,
  TimeSeriesTable,
} from "../../core/storage/time-series-storage.js";

/**
 * In-memory TimeSeriesStorage for tests and local development without
 * Postgres / ClickHouse. Stores rows per table; query applies the same
 * filters as PrismaTimeSeriesStorage / ClickHouseTimeSeriesStorage.
 */
export class MemoryTimeSeriesStorage implements TimeSeriesStorage {
  private readonly tables: Record<TimeSeriesTable, TimeSeriesRow[]> = {
    log_line: [],
    system_metric: [],
    trace: [],
    span: [],
  };

  async insertBatch(table: TimeSeriesTable, rows: TimeSeriesRow[]): Promise<void> {
    if (rows.length === 0) return;
    this.tables[table].push(...rows.map((r) => ({ ...r })));
  }

  async query(table: TimeSeriesTable, options: TimeSeriesQueryOptions): Promise<TimeSeriesRow[]> {
    const rows = this.tables[table];
    const filtered = rows.filter((row) => {
      if (options.runId !== undefined && row.runId !== options.runId) return false;
      if (options.projectId !== undefined && row.projectId !== options.projectId) return false;

      const timestampColumn = this.timestampColumnFor(table);
      const ts = this.extractTimestamp(row, timestampColumn);
      if (options.start && ts && ts < options.start.getTime()) return false;
      if (options.end && ts && ts > options.end.getTime()) return false;
      return true;
    });

    const direction = options.orderBy?.direction ?? "desc";
    const column = options.orderBy?.column ?? this.timestampColumnFor(table);

    filtered.sort((a, b) => {
      const av = this.extractTimestamp(a, column) ?? 0;
      const bv = this.extractTimestamp(b, column) ?? 0;
      return direction === "asc" ? av - bv : bv - av;
    });

    return filtered.slice(0, options.limit).map((r) => ({ ...r }));
  }

  private timestampColumnFor(table: TimeSeriesTable): string {
    switch (table) {
      case "system_metric":
        return "loggedAt";
      case "span":
      case "trace":
        return "startedAt";
      case "log_line":
      default:
        return "timestamp";
    }
  }

  /** Test helper: clear all tables. */
  reset(): void {
    this.tables.log_line = [];
    this.tables.system_metric = [];
    this.tables.trace = [];
    this.tables.span = [];
  }

  private extractTimestamp(row: TimeSeriesRow, column: string): number | undefined {
    const value = row[column];
    if (value == null) return undefined;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }
}