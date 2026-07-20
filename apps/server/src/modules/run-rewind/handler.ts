import type { FastifyReply, FastifyRequest } from "fastify";
import { RewindRunSchema } from "./schema.js";
import { RunRewindService } from "./service.js";

export class RunRewindHandler {
  constructor(private readonly service: RunRewindService) {}

  async rewind(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const data = RewindRunSchema.parse(req.body);
    const state = await this.service.rewind(req.params.id, data);
    if (!state) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    reply.send(state);
  }
}