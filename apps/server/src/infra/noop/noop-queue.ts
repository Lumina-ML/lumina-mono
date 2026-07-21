import type { Queue, QueueJob } from "../../core/queue/queue.js";
import type { JobName } from "../../jobs/types.js";

export class NoopQueue implements Queue {
  async enqueue<N extends JobName>(job: QueueJob<N>): Promise<void> {
    // Phase 1: queue is optional. Log and drop.
    console.debug("NoopQueue dropped job", job.name);
  }
}
