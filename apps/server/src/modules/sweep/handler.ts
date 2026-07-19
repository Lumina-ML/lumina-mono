import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { SweepService } from "./service.js";
import {
  CreateSweepSchema,
  UpdateSweepSchema,
  SuggestRequestSchema,
  ShouldTerminateRequestSchema,
  ListSweepsQuerySchema,
} from "./schema.js";
import { ProjectService } from "../project/service.js";
import { RunService } from "../run/service.js";
import {
  assertOwnsProject,
  assertOwnsSweep,
} from "../../core/authz/assert-workspace.js";

const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
const SweepParamsSchema = z.object({ sweepId: z.string().uuid() });

export class SweepHandler {
  constructor(
    private readonly sweepService: SweepService,
    private readonly projectService: ProjectService,
    private readonly runService: RunService,
  ) {}

  async create(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    if (!(await assertOwnsProject(req.server.prisma, req, reply, projectId))) return;
    const data = CreateSweepSchema.parse(req.body);
    const sweep = await this.sweepService.create(projectId, data);
    reply.status(201).send(sweep);
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    if (!(await assertOwnsProject(req.server.prisma, req, reply, projectId))) return;
    const sweeps = await this.sweepService.listByProject(projectId);
    reply.send({ items: sweeps });
  }

  /**
   * Workspace-wide sweep list. Backed by `GET /sweeps`. Same wire shape as
   * `/runs` (`{ items, total }`) so the dashboard's top-level Sweeps view
   * can paginate without extra plumbing. Always scoped to the requestor's
   * workspace.
   */
  async listAll(req: FastifyRequest, reply: FastifyReply) {
    const query = ListSweepsQuerySchema.parse(req.query);
    const result = await this.sweepService.list({
      ...query,
      workspaceId: req.workspaceId,
    });
    reply.send(result);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { sweepId } = SweepParamsSchema.parse(req.params);
    if (!(await assertOwnsSweep(req.server.prisma, req, reply, sweepId))) return;
    const sweep = await this.sweepService.findById(sweepId);
    if (!sweep) {
      reply.status(404).send({ error: "Sweep not found" });
      return;
    }
    reply.send(sweep);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { sweepId } = SweepParamsSchema.parse(req.params);
    if (!(await assertOwnsSweep(req.server.prisma, req, reply, sweepId))) return;
    const data = UpdateSweepSchema.parse(req.body);
    const sweep = await this.sweepService.update(sweepId, data);
    reply.send(sweep);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { sweepId } = SweepParamsSchema.parse(req.params);
    if (!(await assertOwnsSweep(req.server.prisma, req, reply, sweepId))) return;
    await this.sweepService.delete(sweepId);
    reply.status(204).send();
  }

  async listObservations(req: FastifyRequest, reply: FastifyReply) {
    const { sweepId } = SweepParamsSchema.parse(req.params);
    if (!(await assertOwnsSweep(req.server.prisma, req, reply, sweepId))) return;
    const observations = await this.sweepService.listObservations(sweepId);
    reply.send({ items: observations });
  }

  async suggest(req: FastifyRequest, reply: FastifyReply) {
    const { sweepId } = SweepParamsSchema.parse(req.params);
    if (!(await assertOwnsSweep(req.server.prisma, req, reply, sweepId))) return;
    const { count } = SuggestRequestSchema.parse(req.body ?? {});
    const candidates = await this.sweepService.suggestNext(sweepId, count);
    reply.send({ candidates });
  }

  async shouldTerminate(req: FastifyRequest, reply: FastifyReply) {
    const { sweepId } = SweepParamsSchema.parse(req.params);
    if (!(await assertOwnsSweep(req.server.prisma, req, reply, sweepId))) return;
    const data = ShouldTerminateRequestSchema.parse(req.body);
    const result = await this.sweepService.evaluateEarlyTermination(
      sweepId,
      data.runId,
      data.step,
      data.metric,
    );
    reply.send(result);
  }

  async recordBestRun(req: FastifyRequest, reply: FastifyReply) {
    const { sweepId } = SweepParamsSchema.parse(req.params);
    if (!(await assertOwnsSweep(req.server.prisma, req, reply, sweepId))) return;
    const bestRunId = await this.sweepService.recordBestRun(sweepId);
    reply.send({ bestRunId });
  }
}