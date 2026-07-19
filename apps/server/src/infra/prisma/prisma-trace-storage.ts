import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  SpanQueryOptions,
  SpanRow,
  SpanKind,
  SpanStatus,
  TraceQueryOptions,
  TraceRow,
  TraceStatus,
  TraceStorage,
} from "../../core/storage/trace-storage.js";
import { toDate, toDateOrNull } from "../../utils/date.js";

/**
 * Postgres-backed TraceStorage. Maps the natural-key TraceStorage interface
 * onto Prisma's surrogate-UUID schema by resolving traceId/spanId <-> id.
 */
export class PrismaTraceStorage implements TraceStorage {
  constructor(private readonly prisma: PrismaClient) {}

  async insertTrace(row: TraceRow): Promise<void> {
    await this.prisma.trace.create({
      data: {
        projectId: row.projectId,
        runId: row.runId ?? null,
        traceId: row.traceId,
        name: row.name,
        status: (row.status ?? "ok") as TraceStatus,
        latencyMs: row.latencyMs ?? null,
        metadata: (row.metadata as object | undefined) ?? {},
        startedAt: toDate(row.startedAt),
        finishedAt: toDateOrNull(row.finishedAt),
      },
    });
  }

  async findTrace(traceId: string): Promise<TraceRow | null> {
    const trace = await this.prisma.trace.findUnique({ where: { traceId } });
    return trace ? this.toTraceRow(trace) : null;
  }

  async listTraces(options: TraceQueryOptions): Promise<TraceRow[]> {
    const where: Record<string, unknown> = {};
    if (options.projectId !== undefined) where.projectId = options.projectId;
    if (options.runId !== undefined) where.runId = options.runId;
    const traces = await this.prisma.trace.findMany({
      where,
      orderBy: { startedAt: options.orderByStartedAt ?? "desc" },
      take: options.limit ?? 100,
    });
    return traces.map((t) => this.toTraceRow(t));
  }

  async updateTrace(traceId: string, updates: Partial<TraceRow>): Promise<TraceRow | null> {
    const data: Record<string, unknown> = {};
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.latencyMs !== undefined) data.latencyMs = updates.latencyMs;
    if (updates.metadata !== undefined) data.metadata = updates.metadata;
    if (updates.finishedAt !== undefined) {
      data.finishedAt = updates.finishedAt ? new Date(updates.finishedAt as string | number | Date) : null;
    }
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.runId !== undefined) data.runId = updates.runId;

    if (Object.keys(data).length === 0) return this.findTrace(traceId);

    const trace = await this.prisma.trace.update({ where: { traceId }, data });
    return this.toTraceRow(trace);
  }

  async insertSpan(row: SpanRow): Promise<void> {
    const trace = await this.prisma.trace.findUnique({
      where: { traceId: row.traceId },
      select: { id: true },
    });
    if (!trace) throw new Error(`Trace not found: ${row.traceId}`);

    let parentInternalId: string | null = null;
    if (row.parentSpanId) {
      const parent = await this.prisma.span.findUnique({
        where: { spanId: row.parentSpanId },
        select: { id: true },
      });
      if (!parent) throw new Error(`Parent span not found: ${row.parentSpanId}`);
      parentInternalId = parent.id;
    }

    await this.prisma.span.create({
      data: {
        traceId: trace.id,
        parentSpanId: parentInternalId,
        spanId: row.spanId,
        name: row.name,
        kind: (row.kind ?? "internal") as SpanKind,
        input: (row.input as object | undefined) ?? {},
        output: (row.output as object | undefined) ?? {},
        latencyMs: row.latencyMs ?? null,
        status: (row.status ?? "ok") as SpanStatus,
        startedAt: toDate(row.startedAt),
        finishedAt: toDateOrNull(row.finishedAt),
      },
    });
  }

  async findSpan(spanId: string): Promise<SpanRow | null> {
    const span = await this.prisma.span.findUnique({
      where: { spanId },
      include: {
        trace: { select: { traceId: true } },
        parentSpan: { select: { spanId: true } },
      },
    });
    return span ? this.toSpanRow(span) : null;
  }

  async listSpans(options: SpanQueryOptions): Promise<SpanRow[]> {
    // Map natural traceId filter to internal id.
    let traceInternalId: string | undefined;
    if (options.traceId) {
      const trace = await this.prisma.trace.findUnique({
        where: { traceId: options.traceId },
        select: { id: true },
      });
      if (!trace) return [];
      traceInternalId = trace.id;
    }

    // Resolve parentSpanId (natural) to internal id for filtering, if provided.
    let parentInternalId: string | undefined;
    if (options.parentSpanId) {
      const parent = await this.prisma.span.findUnique({
        where: { spanId: options.parentSpanId },
        select: { id: true },
      });
      if (!parent) return [];
      parentInternalId = parent.id;
    }

    const where: Record<string, unknown> = {};
    if (traceInternalId !== undefined) where.traceId = traceInternalId;
    if (parentInternalId !== undefined) where.parentSpanId = parentInternalId;

    const spans = await this.prisma.span.findMany({
      where,
      orderBy: { startedAt: options.orderByStartedAt ?? "asc" },
      take: options.limit ?? 1000,
      include: {
        trace: { select: { traceId: true } },
        parentSpan: { select: { spanId: true } },
      },
    });

    return spans.map((s) => this.toSpanRow(s));
  }

  async updateSpan(spanId: string, updates: Partial<SpanRow>): Promise<SpanRow | null> {
    const data: Record<string, unknown> = {};
    if (updates.output !== undefined) data.output = updates.output;
    if (updates.latencyMs !== undefined) data.latencyMs = updates.latencyMs;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.finishedAt !== undefined) {
      data.finishedAt = updates.finishedAt
        ? new Date(updates.finishedAt as string | number | Date)
        : null;
    }
    if (updates.name !== undefined) data.name = updates.name;

    if (Object.keys(data).length === 0) return this.findSpan(spanId);

    const span = await this.prisma.span.update({
      where: { spanId },
      data,
      include: {
        trace: { select: { traceId: true } },
        parentSpan: { select: { spanId: true } },
      },
    });
    return this.toSpanRow(span);
  }

  private toTraceRow(t: {
    projectId: string;
    runId: string | null;
    traceId: string;
    name: string;
    status: string;
    latencyMs: number | null;
    metadata: unknown;
    startedAt: Date;
    finishedAt: Date | null;
  }): TraceRow {
    return {
      projectId: t.projectId,
      runId: t.runId,
      traceId: t.traceId,
      name: t.name,
      status: t.status as TraceStatus,
      latencyMs: t.latencyMs,
      metadata: (t.metadata as Record<string, unknown> | null) ?? {},
      startedAt: t.startedAt,
      finishedAt: t.finishedAt,
    };
  }

  private toSpanRow(s: {
    traceId: string;
    parentSpanId: string | null;
    spanId: string;
    name: string;
    kind: string;
    input: unknown;
    output: unknown;
    latencyMs: number | null;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    trace?: { traceId: string } | null;
    parentSpan?: { spanId: string } | null;
  }): SpanRow {
    return {
      traceId: s.trace?.traceId ?? s.traceId,
      parentSpanId: s.parentSpan?.spanId ?? null,
      spanId: s.spanId,
      name: s.name,
      kind: s.kind as SpanKind,
      input: (s.input as Record<string, unknown> | null) ?? {},
      output: (s.output as Record<string, unknown> | null) ?? {},
      latencyMs: s.latencyMs,
      status: s.status as SpanStatus,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
    };
  }
}