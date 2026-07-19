import { Worker } from "bullmq";
import { Redis } from "ioredis";
import type { JobContext } from "./types.js";
import { createJobRegistry } from "./registry.js";

export interface JobWorkerConfig {
  redisUrl: string;
  queueName?: string;
  ctx: JobContext;
}

export function createJobWorker(config: JobWorkerConfig): Worker {
  const registry = createJobRegistry();
  const processorMap = new Map(registry.map((p) => [p.name, p]));

  const worker = new Worker(
    config.queueName ?? "lumina-jobs",
    async (job) => {
      const processor = processorMap.get(job.name);
      if (!processor) {
        throw new Error(`No processor registered for job: ${job.name}`);
      }
      await processor.process({ name: job.name, payload: job.data }, config.ctx);
    },
    {
      connection: new Redis(config.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      }),
      concurrency: 5,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.name}:${job?.id} failed`, err);
  });

  return worker;
}
