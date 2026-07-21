import { Worker } from "bullmq";
import { Redis } from "ioredis";
import type { JobContext, JobName, JobPayloadByName } from "./types.js";
import { jobPayloadSchema } from "./types.js";
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
      // Validate the wire-format payload before handing it to the
      // processor. BullMQ serializes through JSON, so a malformed payload
      // (missing field, wrong type, unknown discriminator) would otherwise
      // reach the processor as `unknown` and be force-cast inside it.
      const parseResult = jobPayloadSchema.safeParse({
        name: job.name,
        payload: job.data,
      });
      if (!parseResult.success) {
        config.ctx.logger.error(
          { jobName: job.name, jobId: job.id, issues: parseResult.error.issues },
          "Refusing to dispatch malformed job payload",
        );
        throw new Error(`Malformed job payload for ${job.name}: ${parseResult.error.message}`);
      }
      const processor = processorMap.get(job.name as JobName);
      if (!processor) {
        throw new Error(`No processor registered for job: ${job.name}`);
      }
      // Narrow the payload before calling the processor so its impl
      // doesn't have to do another `as` cast.
      const payload = (parseResult.data as { payload: JobPayloadByName[JobName] }).payload;
      await processor.process(payload, config.ctx);
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
    config.ctx.logger.error(
      { jobName: job?.name, jobId: job?.id, err },
      "Job failed",
    );
  });

  return worker;
}