import type { TraceStorage } from "../../core/storage/trace-storage.js";
import type { SpanRow, TraceRow } from "../../core/storage/trace-storage.js";
import type {
  CreateTraceInput,
  PatchTraceInput,
  CreateSpanInput,
  PatchSpanInput,
  ListTracesQuery,
} from "./schema.js";

/**
 * Repository facade over `TraceStorage`. The service layer talks to this
 * class; the storage backend (Prisma / ClickHouse / Memory) is hidden.
 */
export class TraceRepository {
  constructor(private readonly storage: TraceStorage) {}

  async createTrace(projectId: string, data: CreateTraceInput & { traceId: string }): Promise<TraceRow> {
    const row: TraceRow = {
      projectId,
      runId: data.runId ?? null,
      traceId: data.traceId,
      name: data.name,
      status: "ok",
      latencyMs: null,
      metadata: data.metadata ?? {},
      startedAt: new Date(),
      finishedAt: null,
    };
    await this.storage.insertTrace(row);
    return row;
  }

  async findByTraceId(traceId: string): Promise<{ trace: TraceRow; spans: SpanRow[] } | null> {
    const trace = await this.storage.findTrace(traceId);
    if (!trace) return null;
    const spans = await this.storage.listSpans({ traceId, orderByStartedAt: "asc" });
    return { trace, spans };
  }

  async listByProject(projectId: string): Promise<TraceRow[]> {
    return this.storage.listTraces({ projectId, orderByStartedAt: "desc" });
  }

  /**
   * Workspace-wide paginated trace list. Delegates to the storage layer's
   * `listTracesPaginated` so both Postgres and ClickHouse backends can
   * honour `limit` / `offset` consistently.
   */
  async list(params: ListTracesQuery): Promise<{ items: TraceRow[]; total: number }> {
    return this.storage.listTracesPaginated({
      ...(params.projectId ? { projectId: params.projectId } : {}),
      limit: params.limit,
      offset: params.offset,
      orderByStartedAt: "desc",
    });
  }

  async updateTrace(traceId: string, data: PatchTraceInput): Promise<TraceRow | null> {
    const updates: Partial<TraceRow> = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.latencyMs !== undefined) updates.latencyMs = data.latencyMs;
    if (data.metadata !== undefined) updates.metadata = data.metadata;
    if (data.finishedAt !== undefined) updates.finishedAt = data.finishedAt;
    // Setting `status` (ok/error) implies the trace has finished; stamp
    // finishedAt if the caller didn't supply one. This matches the SDK's
    // `client.patch_trace(tid, status, latency_ms)` semantics.
    if (data.status !== undefined && data.finishedAt === undefined) {
      updates.finishedAt = new Date();
    }

    if (Object.keys(updates).length === 0) {
      return this.storage.findTrace(traceId);
    }
    return this.storage.updateTrace(traceId, updates);
  }

  async createSpan(traceId: string, data: CreateSpanInput & { spanId: string; parentSpanId?: string }): Promise<SpanRow> {
    const row: SpanRow = {
      traceId,
      parentSpanId: data.parentSpanId ?? null,
      spanId: data.spanId,
      name: data.name,
      kind: data.kind,
      input: data.input ?? {},
      output: data.output ?? {},
      latencyMs: data.latencyMs ?? null,
      status: data.status ?? "ok",
      startedAt: new Date(),
      finishedAt: null,
    };
    await this.storage.insertSpan(row);
    return row;
  }

  async findSpanById(spanId: string): Promise<SpanRow | null> {
    return this.storage.findSpan(spanId);
  }

  async updateSpan(spanId: string, data: PatchSpanInput): Promise<SpanRow | null> {
    const updates: Partial<SpanRow> = {};
    if (data.output !== undefined) updates.output = data.output;
    if (data.latencyMs !== undefined) updates.latencyMs = data.latencyMs;
    if (data.status !== undefined) updates.status = data.status;
    if (data.finishedAt !== undefined) updates.finishedAt = data.finishedAt;
    if (data.status !== undefined && data.finishedAt === undefined) {
      updates.finishedAt = new Date();
    }

    if (Object.keys(updates).length === 0) {
      return this.storage.findSpan(spanId);
    }
    return this.storage.updateSpan(spanId, updates);
  }
}