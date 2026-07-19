/**
 * TraceStorage abstracts persistence for traces and spans. Traces have a
 * mutable lifecycle (create -> finish) that does not fit the append-only
 * TimeSeriesStorage semantics, so they get their own abstraction. Both
 * Postgres (via Prisma) and ClickHouse-backed implementations live in
 * `apps/server/src/infra/`.
 */

export type TraceStatus = "ok" | "error";
export type SpanStatus = "ok" | "error";
export type SpanKind =
  | "llm"
  | "tool"
  | "retriever"
  | "chain"
  | "agent"
  | "internal";

export interface TraceRow {
  projectId: string;
  runId?: string | null;
  traceId: string;
  name: string;
  status: TraceStatus;
  latencyMs?: number | null;
  metadata?: Record<string, unknown>;
  startedAt: Date | string;
  finishedAt?: Date | string | null;
}

export interface SpanRow {
  traceId: string;
  parentSpanId?: string | null;
  spanId: string;
  name: string;
  kind: SpanKind;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  latencyMs?: number | null;
  status: SpanStatus;
  startedAt: Date | string;
  finishedAt?: Date | string | null;
}

export interface TraceQueryOptions {
  projectId?: string;
  /**
   * Filter to a set of project ids. The caller resolves this from
   * `workspaceId` (the storage backends don't model the workspace relation).
   * Honoured by `listTraces` / `listTracesPaginated` — when supplied, traces
   * are limited to those whose `projectId` is in the list.
   */
  projectIds?: string[];
  traceId?: string;
  runId?: string;
  limit?: number;
  /**
   * Page offset for paginated lists. Only honoured by
   * `listTracesPaginated`; the older `listTraces` path is single-shot.
   */
  offset?: number;
  orderByStartedAt?: "asc" | "desc";
}

export interface SpanQueryOptions {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  limit?: number;
  orderByStartedAt?: "asc" | "desc";
}

export interface TraceStorage {
  // Trace operations
  insertTrace(row: TraceRow): Promise<void>;
  findTrace(traceId: string): Promise<TraceRow | null>;
  listTraces(options: TraceQueryOptions): Promise<TraceRow[]>;
  /**
   * Paginated trace list. Returns `{ items, total }` so the workspace-wide
   * `/traces` endpoint can paginate without an extra count round trip.
   * When `projectId` is omitted, returns across every project.
   */
  listTracesPaginated(options: TraceQueryOptions): Promise<{ items: TraceRow[]; total: number }>;
  updateTrace(traceId: string, updates: Partial<TraceRow>): Promise<TraceRow | null>;

  // Span operations
  insertSpan(row: SpanRow): Promise<void>;
  findSpan(spanId: string): Promise<SpanRow | null>;
  listSpans(options: SpanQueryOptions): Promise<SpanRow[]>;
  updateSpan(spanId: string, updates: Partial<SpanRow>): Promise<SpanRow | null>;
}