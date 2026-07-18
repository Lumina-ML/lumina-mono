import type { FastifyReply, FastifyRequest } from "fastify";
import { RunService } from "./service.js";
import {
  CreateRunSchema,
  ListRunsQuerySchema,
  UpdateRunSchema,
  type ListRunsQuery,
} from "./schema.js";

export class RunHandler {
  constructor(private readonly service: RunService) {}

  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = CreateRunSchema.parse(req.body);
    const run = await this.service.create(data);
    reply.status(201).send(run);
  }

  async list(
    req: FastifyRequest<{ Querystring: ListRunsQuery }>,
    reply: FastifyReply,
  ) {
    const query = ListRunsQuerySchema.parse(req.query);
    const result = await this.service.list(query);
    reply.send(result);
  }

  async getById(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const run = await this.service.getById(req.params.id);
    reply.send(run);
  }

  async update(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const data = UpdateRunSchema.parse(req.body);
    const run = await this.service.update(req.params.id, data);
    reply.send(run);
  }
}
