import type { FastifyReply, FastifyRequest } from "fastify";
import { RunService } from "./service.js";
import {
  CreateRunSchema,
  ListRunsQuerySchema,
  UpdateRunSchema,
  type ListRunsQuery,
} from "./schema.js";
import { ProjectService } from "../project/service.js";

const DEFAULT_WORKSPACE_ID = "default";

export class RunHandler {
  constructor(
    private readonly runService: RunService,
    private readonly projectService: ProjectService,
  ) {}

  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = CreateRunSchema.parse(req.body);

    const project = await this.projectService.findOrCreate(
      DEFAULT_WORKSPACE_ID,
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

    let projectId: string | undefined;
    if (query.project) {
      const project = await this.projectService.findByName(
        DEFAULT_WORKSPACE_ID,
        query.project,
      );
      projectId = project?.id;
    }

    const result = await this.runService.list({
      projectId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
    reply.send(result);
  }

  async getById(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const run = await this.runService.getByRunId(req.params.id);
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
}
