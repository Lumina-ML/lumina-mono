import type { FastifyReply, FastifyRequest } from "fastify";
import { SystemMetricService } from "./service.js";
import {
  ListSystemMetricsQuerySchema,
  LogSystemMetricsSchema,
  type ListSystemMetricsQuery,
} from "./schema.js";
import { RunService } from "../run/service.js";

export class SystemMetricHandler {
  constructor(
    private readonly systemMetricService: SystemMetricService,
    private readonly runService: RunService,
  ) {}

  async log(
    req: FastifyRequest<{ Params: { runId: string } }>,
    reply: FastifyReply,
  ) {
    // Workspace ownership is enforced by the `workspaceGuardPlugin`
    // preHandler hook via `config.authz` on this route.
    const data = LogSystemMetricsSchema.parse(req.body);
    const run = await this.runService.getByRunId(req.params.runId);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    await this.systemMetricService.log(run.runId, run.projectId, data);
    reply.status(201).send({ success: true });
  }

  async list(
    req: FastifyRequest<{ Params: { runId: string }; Querystring: ListSystemMetricsQuery }>,
    reply: FastifyReply,
  ) {
    const query = ListSystemMetricsQuerySchema.parse(req.query);
    const run = await this.runService.getByRunId(req.params.runId);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    const keys = query.keys ? query.keys.split(",") : undefined;
    const result = await this.systemMetricService.list(run.runId, {
      keys,
      limit: query.limit,
    });
    reply.send(result);
  }
}
