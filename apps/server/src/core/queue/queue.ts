import type { JobPayload, JobName } from "../../jobs/types.js";

/**
 * The wire-shape of a job enqueued onto the durable queue. BullMQ
 * serializes through JSON, so the runtime type comes from
 * `jobPayloadSchema.parse(...)` in `apps/server/src/jobs/worker.ts`. This
 * interface stays aligned with that schema so a producer cannot enqueue
 * a job the worker won't accept.
 */
export interface QueueJob<N extends JobName = JobName> {
  name: N;
  payload: Extract<JobPayload, { name: N }>["payload"];
}

export interface Queue {
  enqueue<N extends JobName>(job: QueueJob<N>): Promise<void>;
}