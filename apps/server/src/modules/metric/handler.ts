import type { FastifyReply, FastifyRequest } from "fastify";
import { MetricService } from "./service.js";
import { ListMetricsQuerySchema, LogMetricsSchema, type ListMetricsQuery } from "./schema.js";
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
    await this.metricService.log(run.runId, run.projectId, data);
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
}
