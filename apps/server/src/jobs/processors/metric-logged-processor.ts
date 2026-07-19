import type { JobProcessor, JobContext } from "../types.js";

export class MetricLoggedProcessor implements JobProcessor {
  readonly name = "metric.logged";

  async process(
    job: { name: string; payload: unknown },
    ctx: JobContext,
  ): Promise<void> {
    const payload = job.payload as {
      runId: string;
      projectId: string;
      keys: string[];
      count: number;
    };

    // Example async side effect: aggregate latest metric summary for the run.
    // In production, this could compute avg/max/min per key and update Run.summary.
    const result = await ctx.metricStorage.listMetrics(payload.runId, { limit: 10000 });

    const summary: Record<string, { last?: number; count: number }> = {};
    for (const [key, points] of Object.entries(result.metrics)) {
      summary[key] = {
        last: points[points.length - 1]?.value,
        count: points.length,
      };
    }

    await ctx.prisma.run.update({
      where: { runId: payload.runId },
      data: { summary },
    });

    // Invalidate any cached run summary.
    await ctx.cache.delete(`run:summary:${payload.runId}`);
  }
}
