import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/index.js";
import type { Queue } from "../../core/queue/queue.js";
import { TOKENS } from "../../core/di/tokens.js";
import type {
  CreateLaunchQueueInput,
  CreateLaunchJobInput,
  CreateLaunchRunInput,
  PatchLaunchRunInput,
} from "./schema.js";
import { LaunchRepository } from "./repository.js";

@injectable()
export class LaunchService {
  private readonly repository: LaunchRepository;

  constructor(
    @inject(TOKENS.PrismaClient) prisma: PrismaClient,
    @inject(TOKENS.Queue) private readonly queue: Queue,
  ) {
    this.repository = new LaunchRepository(prisma);
  }

  async createQueue(projectId: string, data: CreateLaunchQueueInput) {
    return this.repository.createQueue(projectId, data);
  }

  async findQueueById(id: string) {
    return this.repository.findQueueById(id);
  }

  async findQueueByName(projectId: string, name: string) {
    return this.repository.findQueueByName(projectId, name);
  }

  async listQueuesByProject(projectId: string) {
    return this.repository.listQueuesByProject(projectId);
  }

  async createJob(projectId: string, data: CreateLaunchJobInput) {
    return this.repository.createJob(projectId, data);
  }

  async findJobById(id: string) {
    return this.repository.findJobById(id);
  }

  async findJobByName(projectId: string, name: string) {
    return this.repository.findJobByName(projectId, name);
  }

  async listJobsByProject(projectId: string) {
    return this.repository.listJobsByProject(projectId);
  }

  async createRun(projectId: string, data: CreateLaunchRunInput) {
    return this.repository.createRun(projectId, data);
  }

  async findRunById(id: string) {
    return this.repository.findRunById(id);
  }

  async listRunsByQueue(queueId: string) {
    return this.repository.listRunsByQueue(queueId);
  }

  async listRunsByProject(projectId: string) {
    return this.repository.listRunsByProject(projectId);
  }

  async updateRun(id: string, data: PatchLaunchRunInput) {
    return this.repository.updateRun(id, data);
  }

  async getNextPendingRun(queueId: string) {
    return this.repository.getNextPendingRun(queueId);
  }

  /** Atomically claim one pending run for `queueId`. The row's status
   * transitions ``pending -> running`` inside the same call so concurrent
   * agents can't double-claim. After a successful claim, enqueue a
   * `launch.run.claimed` job so the worker can run post-claim side
   * effects (heartbeat bookkeeping, websocket broadcast, dead-agent
   * detection). */
  async claimNextPendingRun(queueId: string) {
    const claimed = await this.repository.claimNextPendingRun(queueId);
    // Repository return type is `unknown`; the actual shape (from
    // `prisma.launchRun.findUnique`) carries an `id` field.
    const claimedId = (claimed as { id: string } | null)?.id;
    if (claimedId) {
      await this.queue.enqueue({
        name: "launch.run.claimed",
        payload: { launchRunId: claimedId, queueId },
      });
    }
    return claimed;
  }
}