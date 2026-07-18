import type { Queue, QueueJob } from "../../core/queue/queue.js";

export class NoopQueue implements Queue {
  async enqueue(job: QueueJob): Promise<void> {
    // Phase 1: queue is optional. Log and drop.
    console.debug("NoopQueue dropped job", job.name);
  }
}
