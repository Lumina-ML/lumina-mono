import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateTraceInput,
  PatchTraceInput,
  CreateSpanInput,
  PatchSpanInput,
} from "./schema.js";

export class TraceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createTrace(projectId: string, data: CreateTraceInput & { traceId: string }) {
    return this.prisma.trace.create({
      data: {
        projectId,
        traceId: data.traceId,
        name: data.name,
        runId: data.runId,
        metadata: data.metadata as Record<string, never>,
      },
    });
  }

  async findByTraceId(traceId: string) {
    return this.prisma.trace.findUnique({
      where: { traceId },
      include: {
        spans: { orderBy: { createdAt: "asc" } },
        run: true,
      },
    });
  }

  async listByProject(projectId: string) {
    return this.prisma.trace.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { spans: true },
    });
  }

  async updateTrace(traceId: string, data: PatchTraceInput) {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.latencyMs !== undefined) updateData.latencyMs = data.latencyMs;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as Record<string, never>;
    if (data.finishedAt !== undefined) updateData.finishedAt = data.finishedAt;

    return this.prisma.trace.update({
      where: { traceId },
      data: updateData,
    });
  }

  async createSpan(traceId: string, data: CreateSpanInput & { spanId: string }) {
    return this.prisma.span.create({
      data: {
        traceId,
        spanId: data.spanId,
        parentSpanId: data.parentSpanId,
        name: data.name,
        kind: data.kind,
        input: data.input as Record<string, never>,
        output: data.output as Record<string, never>,
        latencyMs: data.latencyMs,
        status: data.status,
      },
    });
  }

  async findSpanById(spanId: string) {
    return this.prisma.span.findUnique({
      where: { spanId },
      include: { trace: true },
    });
  }

  async updateSpan(spanId: string, data: PatchSpanInput) {
    const updateData: Record<string, unknown> = {};
    if (data.output !== undefined) updateData.output = data.output as Record<string, never>;
    if (data.latencyMs !== undefined) updateData.latencyMs = data.latencyMs;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.finishedAt !== undefined) updateData.finishedAt = data.finishedAt;

    return this.prisma.span.update({
      where: { spanId },
      data: updateData,
    });
  }
}
