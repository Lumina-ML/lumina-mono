import type { FastifyReply, FastifyRequest } from "fastify";
import { RunResumeService } from "./service.js";

export class RunResumeHandler {
  constructor(private readonly service: RunResumeService) {}

  async get(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const state = await this.service.getState(req.params.id);
    if (!state) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    reply.send(state);
  }
}