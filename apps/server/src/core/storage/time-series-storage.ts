// Traces and spans were removed in favor of a dedicated TraceStorage
// abstraction (see ./trace-storage.ts). Their lifecycle is mutable
// (create -> finish), which doesn't fit append-only time-series semantics.
export type TimeSeriesTable = "log_line" | "system_metric";

export interface TimeSeriesRow {
  [key: string]: unknown;
}

export interface TimeSeriesQueryOptions {
  runId?: string;
  projectId?: string;
  start?: Date;
  end?: Date;
  limit: number;
  orderBy?: { column: string; direction: "asc" | "desc" };
}

export interface TimeSeriesStorage {
  insertBatch(table: TimeSeriesTable, rows: TimeSeriesRow[]): Promise<void>;
  query(table: TimeSeriesTable, options: TimeSeriesQueryOptions): Promise<TimeSeriesRow[]>;
}
