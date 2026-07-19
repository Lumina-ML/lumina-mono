import type {
  SpanQueryOptions,
  SpanRow,
  TraceQueryOptions,
  TraceRow,
  TraceStorage,
} from "../../core/storage/trace-storage.js";

/**
 * In-memory TraceStorage for tests and local development. Backed by plain
 * JS arrays, so reads after writes see updated values immediately (unlike
 * the ClickHouse backend, which is eventually consistent).
 */
export class MemoryTraceStorage implements TraceStorage {
  private readonly traces: TraceRow[] = [];
  private readonly spans: SpanRow[] = [];

  async insertTrace(row: TraceRow): Promise<void> {
    this.traces.push({ ...row, metadata: { ...(row.metadata ?? {}) } });
  }

  async findTrace(traceId: string): Promise<TraceRow | null> {
    const matches = this.traces
      .filter((t) => t.traceId === traceId)
      .sort((a, b) => this.startedAtMs(b) - this.startedAtMs(a));
    return matches.length > 0 ? cloneTrace(matches[0]) : null;
  }

  async listTraces(options: TraceQueryOptions): Promise<TraceRow[]> {
    const dir = options.orderByStartedAt ?? "desc";
    const filtered = this.traces.filter((t) => {
      if (options.projectId !== undefined && t.projectId !== options.projectId) return false;
      if (options.runId !== undefined && t.runId !== options.runId) return false;
      if (options.traceId !== undefined && t.traceId !== options.traceId) return false;
      return true;
    });
    filtered.sort((a, b) =>
      dir === "asc" ? this.startedAtMs(a) - this.startedAtMs(b) : this.startedAtMs(b) - this.startedAtMs(a),
    );
    return filtered.slice(0, options.limit ?? 100).map(cloneTrace);
  }

  async listTracesPaginated(
    options: TraceQueryOptions,
  ): Promise<{ items: TraceRow[]; total: number }> {
    const dir = options.orderByStartedAt ?? "desc";
    const filtered = this.traces.filter((t) => {
      if (options.projectId !== undefined && t.projectId !== options.projectId) return false;
      if (
        options.projectIds !== undefined &&
        !options.projectIds.includes(t.projectId)
      ) {
        return false;
      }
      if (options.runId !== undefined && t.runId !== options.runId) return false;
      if (options.traceId !== undefined && t.traceId !== options.traceId) return false;
      return true;
    });
    filtered.sort((a, b) =>
      dir === "asc" ? this.startedAtMs(a) - this.startedAtMs(b) : this.startedAtMs(b) - this.startedAtMs(a),
    );
    const total = filtered.length;
    const offset = options.offset ?? 0;
    const take = options.limit ?? 100;
    return {
      items: filtered.slice(offset, offset + take).map(cloneTrace),
      total,
    };
  }

  async updateTrace(traceId: string, updates: Partial<TraceRow>): Promise<TraceRow | null> {
    const idx = this.traces.findIndex((t) => t.traceId === traceId);
    if (idx < 0) return null;
    const merged: TraceRow = {
      ...this.traces[idx],
      ...updates,
      metadata:
        updates.metadata !== undefined
          ? { ...(updates.metadata ?? {}) }
          : { ...(this.traces[idx].metadata ?? {}) },
    };
    this.traces[idx] = merged;
    return cloneTrace(merged);
  }

  async insertSpan(row: SpanRow): Promise<void> {
    this.spans.push({
      ...row,
      input: { ...(row.input ?? {}) },
      output: { ...(row.output ?? {}) },
    });
  }

  async findSpan(spanId: string): Promise<SpanRow | null> {
    const matches = this.spans
      .filter((s) => s.spanId === spanId)
      .sort((a, b) => this.startedAtMs(b) - this.startedAtMs(a));
    return matches.length > 0 ? cloneSpan(matches[0]) : null;
  }

  async listSpans(options: SpanQueryOptions): Promise<SpanRow[]> {
    const dir = options.orderByStartedAt ?? "asc";
    const filtered = this.spans.filter((s) => {
      if (options.traceId !== undefined && s.traceId !== options.traceId) return false;
      if (options.spanId !== undefined && s.spanId !== options.spanId) return false;
      if (options.parentSpanId !== undefined && s.parentSpanId !== options.parentSpanId) return false;
      return true;
    });
    filtered.sort((a, b) =>
      dir === "asc" ? this.startedAtMs(a) - this.startedAtMs(b) : this.startedAtMs(b) - this.startedAtMs(a),
    );
    return filtered.slice(0, options.limit ?? 1000).map(cloneSpan);
  }

  async updateSpan(spanId: string, updates: Partial<SpanRow>): Promise<SpanRow | null> {
    const idx = this.spans.findIndex((s) => s.spanId === spanId);
    if (idx < 0) return null;
    const merged: SpanRow = {
      ...this.spans[idx],
      ...updates,
      input:
        updates.input !== undefined
          ? { ...(updates.input ?? {}) }
          : { ...(this.spans[idx].input ?? {}) },
      output:
        updates.output !== undefined
          ? { ...(updates.output ?? {}) }
          : { ...(this.spans[idx].output ?? {}) },
    };
    this.spans[idx] = merged;
    return cloneSpan(merged);
  }

  /** Test helper: clear all traces and spans. */
  reset(): void {
    this.traces.length = 0;
    this.spans.length = 0;
  }

  private startedAtMs(row: { startedAt: Date | string }): number {
    return row.startedAt instanceof Date ? row.startedAt.getTime() : Date.parse(String(row.startedAt));
  }
}

function cloneTrace(t: TraceRow): TraceRow {
  return {
    ...t,
    metadata: { ...(t.metadata ?? {}) },
  };
}

function cloneSpan(s: SpanRow): SpanRow {
  return {
    ...s,
    input: { ...(s.input ?? {}) },
    output: { ...(s.output ?? {}) },
  };
}