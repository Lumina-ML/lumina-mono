import type { FastifyReply, FastifyRequest } from "fastify";
import { ProjectService } from "./service.js";
import { CreateProjectSchema, ListProjectsQuerySchema, ProjectParamsSchema, UpdateProjectSchema } from "./schema.js";

export class ProjectHandler {
  constructor(private readonly service: ProjectService) { }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = CreateProjectSchema.parse(req.body);
    const project = await this.service.findOrCreate(req.workspaceId, data);
    reply.status(201).send(project);
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    const query = ListProjectsQuerySchema.parse(req.query);
    const result = await this.service.list(req.workspaceId, query);
    reply.send(result);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = ProjectParamsSchema.parse(req.params);
    // Workspace ownership is enforced by the `workspaceGuardPlugin`
    // preHandler hook via `config.authz` on this route.
    const project = await this.service.findById(id);
    if (!project) {
      reply.status(404).send({ error: "Project not found" });
      return;
    }
    reply.send(project);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = ProjectParamsSchema.parse(req.params);
    const data = UpdateProjectSchema.parse(req.body);
    const project = await this.service.update(id, data);
    reply.send(project);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = ProjectParamsSchema.parse(req.params);
    await this.service.delete(id);
    reply.status(204).send();
  }
}
