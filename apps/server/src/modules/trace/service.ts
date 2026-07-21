import crypto from "node:crypto";
import { inject, injectable } from "tsyringe";
import type { SpanRow, TraceRow, TraceStorage } from "../../core/storage/trace-storage.js";
import { TOKENS } from "../../core/di/tokens.js";
import { NotFoundError } from "../../core/errors/app-error.js";
import type {
  CreateTraceInput,
  PatchTraceInput,
  CreateSpanInput,
  PatchSpanInput,
  ListTracesQuery,
} from "./schema.js";
import { TraceRepository } from "./repository.js";

@injectable()
export class TraceService {
  private readonly repository: TraceRepository;

  constructor(@inject(TOKENS.TraceStorage) storage: TraceStorage) {
    this.repository = new TraceRepository(storage);
  }

  async createTrace(projectId: string, data: CreateTraceInput): Promise<TraceRow> {
    const traceId = data.traceId ?? crypto.randomUUID();
    return this.repository.createTrace(projectId, { ...data, traceId });
  }

  async findByTraceId(traceId: string) {
    return this.repository.findByTraceId(traceId);
  }

  async listByProject(projectId: string): Promise<TraceRow[]> {
    return this.repository.listByProject(projectId);
  }

  async list(params: ListTracesQuery & { projectIds?: string[] }) {
    return this.repository.list(params);
  }

  async updateTrace(traceId: string, data: PatchTraceInput): Promise<TraceRow | null> {
    return this.repository.updateTrace(traceId, data);
  }

  async finishTrace(traceId: string, status?: "ok" | "error", latencyMs?: number): Promise<TraceRow | null> {
    return this.repository.updateTrace(traceId, {
      status,
      latencyMs,
      finishedAt: new Date(),
    });
  }

  async createSpan(traceId: string, data: CreateSpanInput): Promise<SpanRow> {
    const trace = await this.repository.findByTraceId(traceId);
    if (!trace) {
      throw new NotFoundError("Trace", traceId);
    }
    const spanId = data.spanId ?? crypto.randomUUID();
    if (data.parentSpanId) {
      const parent = await this.repository.findSpanById(data.parentSpanId);
      if (!parent) {
        throw new NotFoundError("Parent span", data.parentSpanId);
      }
    }
    return this.repository.createSpan(traceId, { ...data, spanId, parentSpanId: data.parentSpanId });
  }

  async listSpansByTrace(traceId: string): Promise<SpanRow[]> {
    const trace = await this.repository.findByTraceId(traceId);
    if (!trace) {
      throw new NotFoundError("Trace", traceId);
    }
    return trace.spans;
  }

  async findSpanById(spanId: string): Promise<SpanRow | null> {
    return this.repository.findSpanById(spanId);
  }

  async updateSpan(spanId: string, data: PatchSpanInput): Promise<SpanRow | null> {
    return this.repository.updateSpan(spanId, data);
  }

  async finishSpan(
    spanId: string,
    status?: "ok" | "error",
    output?: Record<string, unknown>,
    latencyMs?: number,
  ): Promise<SpanRow | null> {
    return this.repository.updateSpan(spanId, {
      status,
      output,
      latencyMs,
      finishedAt: new Date(),
    });
  }
}