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
    const data = LogMetricsSchema.parse(req.body);
    const run = await this.runService.getByRunId(req.params.runId);
    await this.metricService.log(run.runId, run.projectId, data);
    reply.status(201).send({ success: true });
  }

  async list(
    req: FastifyRequest<{ Params: { runId: string }; Querystring: ListMetricsQuery }>,
    reply: FastifyReply,
  ) {
    const query = ListMetricsQuerySchema.parse(req.query);
    const run = await this.runService.getByRunId(req.params.runId);
    const keys = query.keys ? query.keys.split(",") : undefined;
    const result = await this.metricService.list(run.runId, {
      keys,
      limit: query.limit,
    });
    reply.send(result);
  }
}
