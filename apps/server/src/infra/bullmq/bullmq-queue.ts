import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { QueueJob } from "../../core/queue/queue.js";
import { Queue as CoreQueue } from "../../core/queue/queue.js";

export interface BullMQQueueConfig {
  redisUrl: string;
  queueName?: string;
}

export class BullMQQueue implements CoreQueue {
  private readonly queue: Queue;

  constructor(config: BullMQQueueConfig) {
    this.queue = new Queue(config.queueName ?? "lumina-jobs", {
      connection: new Redis(config.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      }),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    });
  }

  async enqueue(job: QueueJob): Promise<void> {
    await this.queue.add(job.name, job.payload, {
      jobId: `${job.name}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
