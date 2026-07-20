import type { FastifyReply, FastifyRequest } from "fastify";
import { CreateRunAlertSchema } from "./schema.js";
import { RunAlertService } from "./service.js";

export class RunAlertHandler {
  constructor(private readonly service: RunAlertService) {}

  async create(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const data = CreateRunAlertSchema.parse(req.body);
    const alert = await this.service.create(req.params.id, data);
    reply.status(201).send({
      alertId: alert.id,
      runId: alert.runId,
      level: alert.level,
      createdAt: alert.createdAt.toISOString(),
    });
  }
}