import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { LaunchService } from "./service.js";
import {
  CreateLaunchQueueSchema,
  CreateLaunchJobSchema,
  CreateLaunchRunSchema,
  PatchLaunchRunSchema,
} from "./schema.js";
import { ProjectService } from "../project/service.js";
import { requireAuth } from "../../plugins/auth.js";
import {
  assertOwnsLaunchJob,
  assertOwnsLaunchQueue,
  assertOwnsLaunchRun,
  assertOwnsProject,
} from "../../core/authz/assert-workspace.js";

const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
const QueueParamsSchema = z.object({ queueId: z.string().uuid() });
const RunParamsSchema = z.object({ runId: z.string().uuid() });

export class LaunchHandler {
  constructor(
    private readonly launchService: LaunchService,
    private readonly projectService: ProjectService,
  ) {}

  async createQueue(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const { projectId } = ProjectParamsSchema.parse(req.params);
    if (!(await assertOwnsProject(req.server.prisma, req, reply, projectId))) return;
    const data = CreateLaunchQueueSchema.parse(req.body);
    const queue = await this.launchService.createQueue(projectId, data);
    reply.status(201).send(queue);
  }

  async listQueues(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    if (!(await assertOwnsProject(req.server.prisma, req, reply, projectId))) return;
    const queues = await this.launchService.listQueuesByProject(projectId);
    reply.send({ items: queues });
  }

  async getQueue(req: FastifyRequest, reply: FastifyReply) {
    const { queueId } = QueueParamsSchema.parse(req.params);
    if (!(await assertOwnsLaunchQueue(req.server.prisma, req, reply, queueId))) return;
    const queue = await this.launchService.findQueueById(queueId);
    if (!queue) {
      reply.status(404).send({ error: "Queue not found" });
      return;
    }
    reply.send(queue);
  }

  async createJob(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const { projectId } = ProjectParamsSchema.parse(req.params);
    if (!(await assertOwnsProject(req.server.prisma, req, reply, projectId))) return;
    const data = CreateLaunchJobSchema.parse(req.body);
    const job = await this.launchService.createJob(projectId, data);
    reply.status(201).send(job);
  }

  async listJobs(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    if (!(await assertOwnsProject(req.server.prisma, req, reply, projectId))) return;
    const jobs = await this.launchService.listJobsByProject(projectId);
    reply.send({ items: jobs });
  }

  async getJob(req: FastifyRequest, reply: FastifyReply) {
    const { jobId } = z.object({ jobId: z.string().uuid() }).parse(req.params);
    if (!(await assertOwnsLaunchJob(req.server.prisma, req, reply, jobId))) return;
    const job = await this.launchService.findJobById(jobId);
    if (!job) {
      reply.status(404).send({ error: "Job not found" });
      return;
    }
    reply.send(job);
  }

  async createRun(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const { projectId } = ProjectParamsSchema.parse(req.params);
    if (!(await assertOwnsProject(req.server.prisma, req, reply, projectId))) return;
    const data = CreateLaunchRunSchema.parse(req.body);
    const run = await this.launchService.createRun(projectId, data);
    reply.status(201).send(run);
  }

  async listRunsByQueue(req: FastifyRequest, reply: FastifyReply) {
    const { queueId } = QueueParamsSchema.parse(req.params);
    if (!(await assertOwnsLaunchQueue(req.server.prisma, req, reply, queueId))) return;
    const runs = await this.launchService.listRunsByQueue(queueId);
    reply.send({ items: runs });
  }

  async getRun(req: FastifyRequest, reply: FastifyReply) {
    const { runId } = RunParamsSchema.parse(req.params);
    if (!(await assertOwnsLaunchRun(req.server.prisma, req, reply, runId))) return;
    const run = await this.launchService.findRunById(runId);
    if (!run) {
      reply.status(404).send({ error: "Launch run not found" });
      return;
    }
    reply.send(run);
  }

  async patchRun(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const { runId } = RunParamsSchema.parse(req.params);
    if (!(await assertOwnsLaunchRun(req.server.prisma, req, reply, runId))) return;
    const data = PatchLaunchRunSchema.parse(req.body);
    const run = await this.launchService.updateRun(runId, data);
    reply.send(run);
  }

  async dequeueRun(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const { queueId } = QueueParamsSchema.parse(req.params);
    if (!(await assertOwnsLaunchQueue(req.server.prisma, req, reply, queueId))) return;
    // Atomic claim: the row's status flips pending -> running inside this
    // call so concurrent agents can't both win the same run.
    const run = await this.launchService.claimNextPendingRun(queueId);
    if (!run) {
      reply.status(204).send();
      return;
    }
    reply.send(run);
  }
}
