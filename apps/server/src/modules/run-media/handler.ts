import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { RunMediaService } from "./service.js";
import { CreateRunMediaSchema, ListRunMediaQuerySchema } from "./schema.js";
import { ProjectService } from "../project/service.js";
import {
  assertOwnsProject,
  assertOwnsRunMedia,
} from "../../core/authz/assert-workspace.js";

const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
const RunMediaParamsSchema = z.object({ runMediaId: z.string().uuid() });

export class RunMediaHandler {
  constructor(
    private readonly runMediaService: RunMediaService,
    private readonly projectService: ProjectService,
  ) {}

  async createRunMedia(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    if (!(await assertOwnsProject(req.server.prisma, req, reply, projectId))) return;
    const data = CreateRunMediaSchema.parse(req.body);
    const runMedia = await this.runMediaService.createRunMedia(projectId, data);
    reply.status(201).send(runMedia);
  }

  async listRunMedia(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    if (!(await assertOwnsProject(req.server.prisma, req, reply, projectId))) return;
    const query = ListRunMediaQuerySchema.parse(req.query);
    const result = await this.runMediaService.list(projectId, query);
    reply.send(result);
  }

  async getRunMedia(req: FastifyRequest, reply: FastifyReply) {
    const { runMediaId } = RunMediaParamsSchema.parse(req.params);
    if (!(await assertOwnsRunMedia(req.server.prisma, req, reply, runMediaId))) return;
    const runMedia = await this.runMediaService.findById(runMediaId);
    if (!runMedia) {
      reply.status(404).send({ error: "Run media not found" });
      return;
    }
    reply.send(runMedia);
  }
}
