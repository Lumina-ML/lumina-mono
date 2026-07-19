import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { TraceService } from "./service.js";
import {
  CreateTraceSchema,
  PatchTraceSchema,
  CreateSpanSchema,
  PatchSpanSchema,
  ListTracesQuerySchema,
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
    // Workspace ownership is enforced by the `workspaceGuardPlugin`
    // preHandler hook via `config.authz` on this route.
    const data = CreateTraceSchema.parse(req.body);
    const trace = await this.traceService.createTrace(projectId, data);
    reply.status(201).send(trace);
  }

  async listTraces(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const traces = await this.traceService.listByProject(projectId);
    reply.send({ items: traces });
  }

  /**
   * Workspace-wide paginated trace list. Backed by `GET /traces`. Mirrors
   * the `{ items, total }` shape used by `/runs` and `/projects`. Pagination
   * happens in the underlying `TraceStorage` so both Postgres and
   * ClickHouse backends can honour `limit` / `offset` consistently.
   * Always scoped to the requestor's workspace — we pre-resolve
   * `workspaceId` to `projectIds` here because the storage backends don't
   * model the workspace relation.
   */
  async listAllTraces(req: FastifyRequest, reply: FastifyReply) {
    const query = ListTracesQuerySchema.parse(req.query);
    const projectRows = await req.server.prisma.project.findMany({
      where: { workspaceId: req.workspaceId },
      select: { id: true },
    });
    const projectIds = projectRows.map((p) => p.id);
    const result = await this.traceService.list({
      ...query,
      projectIds,
    });
    reply.send(result);
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

  async listSpans(req: FastifyRequest, reply: FastifyReply) {
    const { traceId } = TraceParamsSchema.parse(req.params);
    try {
      const spans = await this.traceService.listSpansByTrace(traceId);
      reply.send({ items: spans });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("Trace not found")) {
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