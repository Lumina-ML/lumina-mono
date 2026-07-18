import type { FastifyReply, FastifyRequest } from "fastify";
import { MetricService } from "./service.js";
import { ListMetricsQuerySchema, LogMetricsSchema, type ListMetricsQuery } from "./schema.js";

export class MetricHandler {
  constructor(private readonly service: MetricService) {}

  async log(
    req: FastifyRequest<{ Params: { runId: string } }>,
    reply: FastifyReply,
  ) {
    const data = LogMetricsSchema.parse(req.body);
    await this.service.log(req.params.runId, data);
    reply.status(201).send({ success: true });
  }

  async list(
    req: FastifyRequest<{ Params: { runId: string }; Querystring: ListMetricsQuery }>,
    reply: FastifyReply,
  ) {
    const query = ListMetricsQuerySchema.parse(req.query);
    const keys = query.keys ? query.keys.split(",") : undefined;
    const result = await this.service.list(req.params.runId, {
      keys,
      limit: query.limit,
    });
    reply.send(result);
  }
}
