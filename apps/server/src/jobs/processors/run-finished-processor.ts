import type { JobContext, JobProcessor, JobPayloadByName } from "../types.js";

type Payload = JobPayloadByName["run.finished"];

export class RunFinishedProcessor implements JobProcessor<"run.finished"> {
  readonly name = "run.finished";

  async process(payload: Payload, ctx: JobContext): Promise<void> {
    // Example async side effects: invalidate caches, log for analytics.
    await ctx.cache.delete(`run:summary:${payload.runId}`);
    await ctx.cache.delete(`run:${payload.runId}`);
  }
}