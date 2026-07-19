import type { JobProcessor, JobContext } from "../types.js";

export class RunFinishedProcessor implements JobProcessor {
  readonly name = "run.finished";

  async process(
    job: { name: string; payload: unknown },
    ctx: JobContext,
  ): Promise<void> {
    const payload = job.payload as {
      runId: string;
      projectId: string;
      status: string;
    };

    // Example async side effects: invalidate caches, log for analytics.
    await ctx.cache.delete(`run:summary:${payload.runId}`);
    await ctx.cache.delete(`run:${payload.runId}`);
  }
}
