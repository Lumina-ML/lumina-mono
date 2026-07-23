import type { ClickHouseClient } from "@clickhouse/client";
import type {
  SpanQueryOptions,
  SpanRow,
  TraceQueryOptions,
  TraceRow,
  TraceStorage,
} from "../../core/storage/trace-storage.js";

/**
 * ClickHouse-backed TraceStorage. Inserts and queries use natural keys
 * (traceId / spanId), so no surrogate-UUID mapping is needed. Updates go
 * through `ALTER TABLE ... UPDATE` which is async; reads are eventually
 * consistent with writes.
 */
export class ClickHouseTraceStorage implements TraceStorage {
  constructor(private readonly client: ClickHouseClient) {}

  async insertTrace(row: TraceRow): Promise<void> {
    await this.client.insert({
      table: "traces",
      format: "JSONEachRow",
      values: [
        {
          projectId: String(row.projectId),
          runId: row.runId ?? null,
          traceId: String(row.traceId),
          name: String(row.name),
          status: String(row.status ?? "ok"),
          latencyMs: row.latencyMs == null ? null : Number(row.latencyMs),
          metadata: JSON.stringify(row.metadata ?? {}),
          startedAt: toClickHouseDate(row.startedAt),
          finishedAt: row.finishedAt ? toClickHouseDate(row.finishedAt) : null,
        },
      ],
    });
  }

  async findTrace(traceId: string): Promise<TraceRow | null> {
    const result = await this.client.query({
      query: `
        SELECT *
        FROM traces
        WHERE traceId = {traceId:String}
        ORDER BY startedAt DESC
        LIMIT 1
      `,
      query_params: { traceId },
      format: "JSONEachRow",
    });
    const rows = await result.json<TraceRowJson>();
    return rows.length > 0 ? this.parseTraceRow(rows[0]) : null;
  }

  async listTraces(options: TraceQueryOptions): Promise<TraceRow[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = { limit: options.limit ?? 100 };
    if (options.projectId !== undefined) {
      conditions.push(`projectId = {projectId:String}`);
      params.projectId = options.projectId;
    }
    if (options.runId !== undefined) {
      conditions.push(`runId = {runId:String}`);
      params.runId = options.runId;
    }
    if (options.traceId !== undefined) {
      conditions.push(`traceId = {traceId:String}`);
      params.traceId = options.traceId;
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const dir = (options.orderByStartedAt ?? "desc").toUpperCase();
    const result = await this.client.query({
      query: `
        SELECT *
        FROM traces
        ${where}
        ORDER BY startedAt ${dir}
        LIMIT {limit:UInt32}
      `,
      query_params: params,
      format: "JSONEachRow",
    });
    const rows = await result.json<TraceRowJson>();
    return rows.map((r) => this.parseTraceRow(r));
  }

  async listTracesPaginated(
    options: TraceQueryOptions,
  ): Promise<{ items: TraceRow[]; total: number }> {
    // ClickHouse has no JOIN — when the caller wants workspace-scoped
    // traces, it must pre-resolve `workspaceId` to a list of `projectIds`.
    // An explicit empty list means "no projects in this workspace" → return
    // zero rows without leaking every trace.
    if (options.projectIds !== undefined && options.projectIds.length === 0) {
      return { items: [], total: 0 };
    }

    const conditions: string[] = [];
    const params: Record<string, unknown> = {
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    };
    if (options.projectId !== undefined) {
      conditions.push(`projectId = {projectId:String}`);
      params.projectId = options.projectId;
    }
    if (options.projectIds !== undefined && options.projectIds.length > 0) {
      // ClickHouse's `IN` with an array parameter — see
      // https://clickhouse.com/docs/en/sql-reference/operators/in
      conditions.push(`projectId IN {projectIds:Array(String)}`);
      params.projectIds = options.projectIds;
    }
    if (options.runId !== undefined) {
      conditions.push(`runId = {runId:String}`);
      params.runId = options.runId;
    }
    if (options.traceId !== undefined) {
      conditions.push(`traceId = {traceId:String}`);
      params.traceId = options.traceId;
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const dir = (options.orderByStartedAt ?? "desc").toUpperCase();
    // Run the page + the count in parallel. ClickHouse's `count()` over the
    // same predicate returns the unfiltered total, which is what the
    // dashboard needs to render pagination controls.
    const [pageResult, countResult] = await Promise.all([
      this.client.query({
        query: `
          SELECT *
          FROM traces
          ${where}
          ORDER BY startedAt ${dir}
          LIMIT {limit:UInt32}
          OFFSET {offset:UInt32}
        `,
        query_params: params,
        format: "JSONEachRow",
      }),
      this.client.query({
        query: `SELECT count() AS total FROM traces ${where}`,
        query_params: params,
        format: "JSONEachRow",
      }),
    ]);
    const [rows, counts] = await Promise.all([
      pageResult.json<TraceRowJson>(),
      countResult.json<{ total: string | number }>(),
    ]);
    const total = Number(counts[0]?.total ?? 0);
    return {
      items: rows.map((r) => this.parseTraceRow(r)),
      total,
    };
  }

  async updateTrace(traceId: string, updates: Partial<TraceRow>): Promise<TraceRow | null> {
    const sets: string[] = [];
    const params: Record<string, unknown> = { traceId };
    if (updates.status !== undefined) {
      sets.push("status = {status:String}");
      params.status = updates.status;
    }
    if (updates.latencyMs !== undefined) {
      sets.push("latencyMs = {latencyMs:UInt32}");
      params.latencyMs = updates.latencyMs ?? 0;
    }
    if (updates.metadata !== undefined) {
      sets.push("metadata = {metadata:String}");
      params.metadata = JSON.stringify(updates.metadata ?? {});
    }
    if (updates.finishedAt !== undefined) {
      sets.push("finishedAt = {finishedAt:DateTime64}");
      params.finishedAt = updates.finishedAt ? toClickHouseDate(updates.finishedAt) : null;
    }
    if (updates.name !== undefined) {
      sets.push("name = {name:String}");
      params.name = updates.name;
    }
    if (updates.runId !== undefined) {
      sets.push("runId = {runId:String}");
      params.runId = updates.runId;
    }

    if (sets.length > 0) {
      await this.client.command({
        query: `ALTER TABLE traces UPDATE ${sets.join(", ")} WHERE traceId = {traceId:String}`,
        query_params: params,
      });
    }
    // ALTER TABLE … UPDATE is async in ClickHouse — a follow-up read can
    // still see the pre-update row. Return the *requested* updates merged
    // with the latest read so callers don't observe stale `latencyMs` /
    // `status` / `finishedAt` on the response they just sent.
    const current = await this.findTrace(traceId);
    if (!current) return null;
    return { ...current, ...updates };
  }

  async insertSpan(row: SpanRow): Promise<void> {
    await this.client.insert({
      table: "spans",
      format: "JSONEachRow",
      values: [
        {
          traceId: String(row.traceId),
          parentSpanId: row.parentSpanId ?? null,
          spanId: String(row.spanId),
          name: String(row.name),
          kind: String(row.kind ?? "internal"),
          input: JSON.stringify(row.input ?? {}),
          output: JSON.stringify(row.output ?? {}),
          latencyMs: row.latencyMs == null ? null : Number(row.latencyMs),
          status: String(row.status ?? "ok"),
          startedAt: toClickHouseDate(row.startedAt),
          finishedAt: row.finishedAt ? toClickHouseDate(row.finishedAt) : null,
        },
      ],
    });
  }

  async findSpan(spanId: string): Promise<SpanRow | null> {
    const result = await this.client.query({
      query: `
        SELECT *
        FROM spans
        WHERE spanId = {spanId:String}
        ORDER BY startedAt DESC
        LIMIT 1
      `,
      query_params: { spanId },
      format: "JSONEachRow",
    });
    const rows = await result.json<SpanRowJson>();
    return rows.length > 0 ? this.parseSpanRow(rows[0]) : null;
  }

  async listSpans(options: SpanQueryOptions): Promise<SpanRow[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = { limit: options.limit ?? 1000 };
    if (options.traceId !== undefined) {
      conditions.push(`traceId = {traceId:String}`);
      params.traceId = options.traceId;
    }
    if (options.spanId !== undefined) {
      conditions.push(`spanId = {spanId:String}`);
      params.spanId = options.spanId;
    }
    if (options.parentSpanId !== undefined) {
      conditions.push(`parentSpanId = {parentSpanId:String}`);
      params.parentSpanId = options.parentSpanId;
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const dir = (options.orderByStartedAt ?? "asc").toUpperCase();
    const result = await this.client.query({
      query: `
        SELECT *
        FROM spans
        ${where}
        ORDER BY startedAt ${dir}
        LIMIT {limit:UInt32}
      `,
      query_params: params,
      format: "JSONEachRow",
    });
    const rows = await result.json<SpanRowJson>();
    return rows.map((r) => this.parseSpanRow(r));
  }

  async updateSpan(spanId: string, updates: Partial<SpanRow>): Promise<SpanRow | null> {
    const sets: string[] = [];
    const params: Record<string, unknown> = { spanId };
    if (updates.output !== undefined) {
      sets.push("output = {output:String}");
      params.output = JSON.stringify(updates.output ?? {});
    }
    if (updates.latencyMs !== undefined) {
      sets.push("latencyMs = {latencyMs:UInt32}");
      params.latencyMs = updates.latencyMs ?? 0;
    }
    if (updates.status !== undefined) {
      sets.push("status = {status:String}");
      params.status = updates.status;
    }
    if (updates.finishedAt !== undefined) {
      sets.push("finishedAt = {finishedAt:DateTime64}");
      params.finishedAt = updates.finishedAt ? toClickHouseDate(updates.finishedAt) : null;
    }
    if (updates.name !== undefined) {
      sets.push("name = {name:String}");
      params.name = updates.name;
    }

    if (sets.length > 0) {
      await this.client.command({
        query: `ALTER TABLE spans UPDATE ${sets.join(", ")} WHERE spanId = {spanId:String}`,
        query_params: params,
      });
    }
    // Same eventual-consistency caveat as updateTrace — merge the
    // requested updates onto the latest read so the response matches
    // what the caller just sent.
    const current = await this.findSpan(spanId);
    if (!current) return null;
    return { ...current, ...updates };
  }

  private parseTraceRow(r: TraceRowJson): TraceRow {
    let metadata: Record<string, unknown> = {};
    if (typeof r.metadata === "string") {
      try {
        metadata = JSON.parse(r.metadata);
      } catch {
        metadata = {};
      }
    }
    return {
      projectId: r.projectId,
      runId: r.runId ?? null,
      traceId: r.traceId,
      name: r.name,
      status: (r.status as TraceRow["status"]) ?? "ok",
      latencyMs: r.latencyMs ?? null,
      metadata,
      startedAt: r.startedAt ? new Date(r.startedAt) : new Date(),
      finishedAt: r.finishedAt ? new Date(r.finishedAt) : null,
    };
  }

  private parseSpanRow(r: SpanRowJson): SpanRow {
    let input: Record<string, unknown> = {};
    if (typeof r.input === "string") {
      try {
        input = JSON.parse(r.input);
      } catch {
        input = {};
      }
    }
    let output: Record<string, unknown> = {};
    if (typeof r.output === "string") {
      try {
        output = JSON.parse(r.output);
      } catch {
        output = {};
      }
    }
    return {
      traceId: r.traceId,
      parentSpanId: r.parentSpanId ?? null,
      spanId: r.spanId,
      name: r.name,
      kind: (r.kind as SpanRow["kind"]) ?? "internal",
      input,
      output,
      latencyMs: r.latencyMs ?? null,
      status: (r.status as SpanRow["status"]) ?? "ok",
      startedAt: r.startedAt ? new Date(r.startedAt) : new Date(),
      finishedAt: r.finishedAt ? new Date(r.finishedAt) : null,
    };
  }
}

interface TraceRowJson {
  projectId: string;
  runId?: string | null;
  traceId: string;
  name: string;
  status?: string;
  latencyMs?: number | null;
  metadata?: string;
  startedAt: string;
  finishedAt?: string | null;
}

interface SpanRowJson {
  traceId: string;
  parentSpanId?: string | null;
  spanId: string;
  name: string;
  kind?: string;
  input?: string;
  output?: string;
  latencyMs?: number | null;
  status?: string;
  startedAt: string;
  finishedAt?: string | null;
}

function toClickHouseDate(value: Date | string | number): string {
  // ClickHouse's query-parameter parser is strict about DateTime64 format
  // and rejects the trailing `Z` that `Date.toISOString()` emits — passing
  // `2026-07-21T16:33:10.449Z` to `ALTER TABLE … UPDATE finishedAt = {p}`
  // fails with "only 23 of 24 bytes was parsed". The space-separated form
  // is accepted by both row-level inserts (lenient parser) and ALTER
  // parameters (strict parser), so we always emit it.
  const d = new Date(value);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.` +
    `${String(d.getUTCMilliseconds()).padStart(3, "0")}`
  );
}