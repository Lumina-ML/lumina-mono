import type { FastifyReply, FastifyRequest } from "fastify";
import { MetricService } from "./service.js";
import {
  CompareMetricsSchema,
  ListMetricsQuerySchema,
  LogMetricsSchema,
  type ListMetricsQuery,
} from "./schema.js";
import { RunService } from "../run/service.js";

export class MetricHandler {
  constructor(
    private readonly metricService: MetricService,
    private readonly runService: RunService,
  ) {}

  async log(
    req: FastifyRequest<{ Params: { runId: string } }>,
    reply: FastifyReply,
  ) {
    // Workspace ownership is enforced by the `workspaceGuardPlugin`
    // preHandler hook via `config.authz` on this route.
    const data = LogMetricsSchema.parse(req.body);
    const run = await this.runService.getByRunId(req.params.runId);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    await this.metricService.log(
      run.runId,
      run.projectId,
      // `findByRunId` now includes the project so the WS fanout can
      // scope MetricLogged to the right workspace channel.
      run.project?.workspaceId ?? req.workspaceId,
      data,
    );
    reply.status(201).send({ success: true });
  }

  async list(
    req: FastifyRequest<{ Params: { runId: string }; Querystring: ListMetricsQuery }>,
    reply: FastifyReply,
  ) {
    const query = ListMetricsQuerySchema.parse(req.query);
    const run = await this.runService.getByRunId(req.params.runId);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    // Accept both `?keys=a,b,c` (comma-separated) and `?keys=a&keys=b&keys=c`
    // (repeated). Normalise to an array before handing off to the service.
    let keys: string[] | undefined;
    if (Array.isArray(query.keys)) {
      keys = query.keys.flatMap((k) => k.split(",")).map((k) => k.trim()).filter(Boolean);
    } else if (typeof query.keys === "string" && query.keys.length > 0) {
      keys = query.keys.split(",").map((k) => k.trim()).filter(Boolean);
    }
    const result = await this.metricService.list(run.runId, {
      keys,
      limit: query.limit,
    });
    reply.send(result);
  }

  async compare(
    req: FastifyRequest<{ Body: unknown }>,
    reply: FastifyReply,
  ) {
    const body = CompareMetricsSchema.parse(req.body);

    // Verify all runs exist and belong to the same project/workspace.
    // The workspace guard enforces ownership at the request level via
    // `req.workspaceId`; here we just ensure the runIds are valid and
    // consistent.
    const runs = await Promise.all(
      body.runIds.map((runId) => this.runService.getByRunId(runId)),
    );
    const missingIndex = runs.findIndex((r) => !r);
    if (missingIndex !== -1) {
      reply.status(404).send({ error: `Run not found: ${body.runIds[missingIndex]}` });
      return;
    }

    const projectIds = new Set(runs.map((r) => r!.projectId));
    if (projectIds.size > 1) {
      reply.status(400).send({ error: "All runs must belong to the same project" });
      return;
    }

    const runWorkspaceIds = new Set(runs.map((r) => r!.project?.workspaceId ?? req.workspaceId));
    if (runWorkspaceIds.size > 1 || [...runWorkspaceIds][0] !== req.workspaceId) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }

    // Normalize keys the same way as `list`.
    let keys: string[] | undefined;
    if (Array.isArray(body.keys)) {
      keys = body.keys.flatMap((k) => k.split(",")).map((k) => k.trim()).filter(Boolean);
    } else if (typeof body.keys === "string" && body.keys.length > 0) {
      keys = body.keys.split(",").map((k) => k.trim()).filter(Boolean);
    }

    const result = await this.metricService.compare({
      runIds: body.runIds,
      keys,
      limit: body.limit,
    });
    reply.send(result);
  }
}
