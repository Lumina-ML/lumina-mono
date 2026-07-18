import crypto from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateTraceInput,
  PatchTraceInput,
  CreateSpanInput,
  PatchSpanInput,
} from "./schema.js";
import { TraceRepository } from "./repository.js";

export class TraceService {
  private readonly repository: TraceRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new TraceRepository(prisma);
  }

  async createTrace(projectId: string, data: CreateTraceInput) {
    const traceId = data.traceId ?? crypto.randomUUID();
    return this.repository.createTrace(projectId, { ...data, traceId });
  }

  async findByTraceId(traceId: string) {
    return this.repository.findByTraceId(traceId);
  }

  async listByProject(projectId: string) {
    return this.repository.listByProject(projectId);
  }

  async updateTrace(traceId: string, data: PatchTraceInput) {
    return this.repository.updateTrace(traceId, data);
  }

  async finishTrace(traceId: string, status?: "ok" | "error", latencyMs?: number) {
    return this.repository.updateTrace(traceId, {
      status,
      latencyMs,
      finishedAt: new Date(),
    });
  }

  async createSpan(traceId: string, data: CreateSpanInput) {
    const spanId = data.spanId ?? crypto.randomUUID();
    return this.repository.createSpan(traceId, { ...data, spanId });
  }

  async findSpanById(spanId: string) {
    return this.repository.findSpanById(spanId);
  }

  async updateSpan(spanId: string, data: PatchSpanInput) {
    return this.repository.updateSpan(spanId, data);
  }

  async finishSpan(spanId: string, status?: "ok" | "error", output?: Record<string, unknown>, latencyMs?: number) {
    return this.repository.updateSpan(spanId, {
      status,
      output,
      latencyMs,
      finishedAt: new Date(),
    });
  }
}
