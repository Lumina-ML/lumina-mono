import type { FastifyReply, FastifyRequest } from "fastify";
import { ProjectService } from "./service.js";
import { CreateProjectSchema } from "./schema.js";

const DEFAULT_WORKSPACE_ID = "default";

export class ProjectHandler {
  constructor(private readonly service: ProjectService) {}

  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = CreateProjectSchema.parse(req.body);
    const project = await this.service.findOrCreate(DEFAULT_WORKSPACE_ID, data);
    reply.status(201).send(project);
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    // TODO: implement pagination and workspace filtering
    reply.send({ items: [], total: 0 });
  }
}
