import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { TraceService } from "./service.js";
import {
  CreateTraceSchema,
  PatchTraceSchema,
  CreateSpanSchema,
  PatchSpanSchema,
} from "./schema.js";
import { ProjectService } from "../project/service.js";

const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
const TraceParamsSchema = z.object({ traceId: z.string().min(1) });
const SpanParamsSchema = z.object({ spanId: z.string().min(1) });

export class TraceHandler {
  constructor(
    private readonly traceService: TraceService,
    private readonly projectService: ProjectService,
  ) {}

  async createTrace(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const data = CreateTraceSchema.parse(req.body);
    const project = await this.projectService.findById(projectId);
    if (!project) {
      reply.status(404).send({ error: "Project not found" });
      return;
    }
    const trace = await this.traceService.createTrace(projectId, data);
    reply.status(201).send(trace);
  }

  async listTraces(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const traces = await this.traceService.listByProject(projectId);
    reply.send({ items: traces });
  }

  async getTrace(req: FastifyRequest, reply: FastifyReply) {
    const { traceId } = TraceParamsSchema.parse(req.params);
    const result = await this.traceService.findByTraceId(traceId);
    if (!result) {
      reply.status(404).send({ error: "Trace not found" });
      return;
    }
    // Flatten to preserve the previous `{ ...trace, spans: [...] }` wire shape
    // that downstream consumers (dashboard) rely on.
    reply.send({ ...result.trace, spans: result.spans });
  }

  async patchTrace(req: FastifyRequest, reply: FastifyReply) {
    const { traceId } = TraceParamsSchema.parse(req.params);
    const data = PatchTraceSchema.parse(req.body);
    const trace = await this.traceService.updateTrace(traceId, data);
    if (!trace) {
      reply.status(404).send({ error: "Trace not found" });
      return;
    }
    reply.send(trace);
  }

  async createSpan(req: FastifyRequest, reply: FastifyReply) {
    const { traceId } = TraceParamsSchema.parse(req.params);
    const data = CreateSpanSchema.parse(req.body);
    try {
      const span = await this.traceService.createSpan(traceId, data);
      reply.status(201).send(span);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("Trace not found") || msg.startsWith("Parent span not found")) {
        reply.status(404).send({ error: msg });
        return;
      }
      throw err;
    }
  }

  async getSpan(req: FastifyRequest, reply: FastifyReply) {
    const { spanId } = SpanParamsSchema.parse(req.params);
    const span = await this.traceService.findSpanById(spanId);
    if (!span) {
      reply.status(404).send({ error: "Span not found" });
      return;
    }
    reply.send(span);
  }

  async patchSpan(req: FastifyRequest, reply: FastifyReply) {
    const { spanId } = SpanParamsSchema.parse(req.params);
    const data = PatchSpanSchema.parse(req.body);
    const span = await this.traceService.updateSpan(spanId, data);
    if (!span) {
      reply.status(404).send({ error: "Span not found" });
      return;
    }
    reply.send(span);
  }
}