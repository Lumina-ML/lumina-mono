import type { FastifyReply, FastifyRequest } from "fastify";
import { RunService } from "./service.js";
import {
  CreateRunSchema,
  ListRunsQuerySchema,
  UpdateRunSchema,
  type ListRunsQuery,
} from "./schema.js";
import { ProjectService } from "../project/service.js";

export class RunHandler {
  constructor(
    private readonly runService: RunService,
    private readonly projectService: ProjectService,
  ) {}

  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = CreateRunSchema.parse(req.body);

    const project = await this.projectService.findOrCreate(
      req.workspaceId,
      { name: data.project },
    );

    const run = await this.runService.create(project.id, data);
    reply.status(201).send(run);
  }

  async list(
    req: FastifyRequest<{ Querystring: ListRunsQuery }>,
    reply: FastifyReply,
  ) {
    const query = ListRunsQuerySchema.parse(req.query);

    let projectId: string | undefined = query.projectId;
    if (!projectId && query.project) {
      const project = await this.projectService.findByName(
        req.workspaceId,
        query.project,
      );
      projectId = project?.id;
    }

    const result = await this.runService.list({
      projectId,
      status: query.status,
      createdAfter: query.createdAfter,
      createdBefore: query.createdBefore,
      limit: query.limit,
      offset: query.offset,
    });
    reply.send(result);
  }

  async getById(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    // Workspace ownership is enforced by the `workspaceGuardPlugin`
    // preHandler hook via `config.authz` on this route.
    const run = await this.runService.getByRunId(req.params.id);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    reply.send(run);
  }

  async update(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const data = UpdateRunSchema.parse(req.body);
    const run = await this.runService.update(req.params.id, data);
    reply.send(run);
  }

  async delete(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    await this.runService.delete(req.params.id);
    reply.status(204).send();
  }
}
