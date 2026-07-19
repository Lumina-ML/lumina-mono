import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateLaunchQueueInput,
  CreateLaunchJobInput,
  CreateLaunchRunInput,
  PatchLaunchRunInput,
} from "./schema.js";

export class LaunchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createQueue(projectId: string, data: CreateLaunchQueueInput) {
    return this.prisma.launchQueue.create({
      data: {
        projectId,
        name: data.name,
        config: data.config as Record<string, never>,
      },
    });
  }

  async findQueueById(id: string) {
    return this.prisma.launchQueue.findUnique({
      where: { id },
      include: { runs: { orderBy: { createdAt: "desc" } } },
    });
  }

  async findQueueByName(projectId: string, name: string) {
    return this.prisma.launchQueue.findUnique({
      where: { projectId_name: { projectId, name } },
    });
  }

  async listQueuesByProject(projectId: string) {
    return this.prisma.launchQueue.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createJob(projectId: string, data: CreateLaunchJobInput) {
    return this.prisma.launchJob.create({
      data: {
        projectId,
        name: data.name,
        image: data.image,
        command: data.command,
        args: data.args,
        env: data.env as Record<string, never>,
        config: data.config as Record<string, never>,
      },
    });
  }

  async findJobById(id: string) {
    return this.prisma.launchJob.findUnique({
      where: { id },
      include: { runs: { orderBy: { createdAt: "desc" } } },
    });
  }

  async findJobByName(projectId: string, name: string) {
    return this.prisma.launchJob.findUnique({
      where: { projectId_name: { projectId, name } },
    });
  }

  async listJobsByProject(projectId: string) {
    return this.prisma.launchJob.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createRun(projectId: string, data: CreateLaunchRunInput) {
    return this.prisma.launchRun.create({
      data: {
        projectId,
        queueId: data.queueId,
        jobId: data.jobId,
        runId: data.runId,
        status: "pending",
        metadata: data.metadata as Record<string, never>,
      },
    });
  }

  async findRunById(id: string) {
    return this.prisma.launchRun.findUnique({
      where: { id },
      include: { queue: true, job: true, run: true },
    });
  }

  async listRunsByQueue(queueId: string) {
    return this.prisma.launchRun.findMany({
      where: { queueId },
      orderBy: { createdAt: "desc" },
      include: { job: true, run: true },
    });
  }

  async listRunsByProject(projectId: string) {
    return this.prisma.launchRun.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { queue: true, job: true, run: true },
    });
  }

  async updateRun(id: string, data: PatchLaunchRunInput) {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.runId !== undefined) updateData.runId = data.runId;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as Record<string, never>;

    return this.prisma.launchRun.update({
      where: { id },
      data: updateData,
      include: { queue: true, job: true, run: true },
    });
  }

  async findOldestPendingId(queueId: string): Promise<string | null> {
    const row = await this.prisma.launchRun.findFirst({
      where: { queueId, status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  /**
   * Atomically claim a single pending run for `queueId`. Uses a
   * compare-and-set update so two concurrent agents can't both win the same
   * run. Returns the claimed row (with job + run joined) or `null` if
   * nothing was pending, or if another worker claimed it first.
   */
  async claimNextPendingRun(queueId: string): Promise<unknown> {
    const id = await this.findOldestPendingId(queueId);
    if (!id) return null;
    const { count } = await this.prisma.launchRun.updateMany({
      where: { id, status: "pending" },
      data: { status: "running" },
    });
    if (count === 0) {
      // Lost the race; another worker grabbed it. Retry once.
      return this.claimNextPendingRun(queueId);
    }
    return this.prisma.launchRun.findUnique({
      where: { id },
      include: { queue: true, job: true, run: true },
    });
  }

  /** Backwards-compatible non-atomic read used by tests/legacy callers. */
  async getNextPendingRun(queueId: string) {
    return this.prisma.launchRun.findFirst({
      where: { queueId, status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { job: true },
    });
  }
}
