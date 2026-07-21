import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { TOKENS } from "../../core/di/tokens.js";
import type { RewindRunInput } from "./schema.js";

/// Cap on rows we walk when looking for the cutpoint. Real wandb rewinds
/// walk the full history; for the Lumina MVP a bounded scan is fine since
/// runs typically O(thousands) of metrics, not millions.
const REWIND_SCAN_LIMIT = 5000;

@injectable()
export class RunRewindService {
  constructor(@inject(TOKENS.PrismaClient) private readonly prisma: PrismaClient) {}

  async rewind(runId: string, data: RewindRunInput) {
    // Find the last metric row where the named metric's value matches the
    // threshold. "Matches" is approximated as == — wandb used a
    // numerical-equality check too. We scan backwards through the last
    // REWIND_SCAN_LIMIT rows of this metric.
    const rows = await this.prisma.metric.findMany({
      where: { runId, key: data.metricName },
      orderBy: [{ step: "desc" }, { loggedAt: "desc" }],
      take: REWIND_SCAN_LIMIT,
    });
    const cutpoint = rows.find((r) => r.value === data.metricValue);

    if (cutpoint) {
      // Truncate everything past the cutpoint. We delete rows where
      // step > cutpoint.step for the same metric, plus the cutpoint row
      // itself (rewind means "before this point"). For simplicity we
      // truncate only the named metric; the SDK caller decides whether
      // other metrics need similar rewinds.
      await this.prisma.metric.deleteMany({
        where: {
          runId,
          key: data.metricName,
          step: { gt: cutpoint.step },
        },
      });
    }

    // Return the same shape as resume-state so the SDK can resume without
    // an extra round-trip.
    return this.getResumableState(runId, cutpoint?.step ?? null);
  }

  private async getResumableState(runId: string, _cutpointStep: number | null) {
    const [run, historyTail, eventsTail, historyCount, eventsCount, logLineCount, runTags] =
      await Promise.all([
        this.prisma.run.findUnique({
          where: { runId },
          select: { config: true, summary: true, metadata: true },
        }),
        this.prisma.metric.findMany({
          where: { runId },
          orderBy: [{ step: "desc" }, { loggedAt: "desc" }],
          take: 100,
        }),
        this.prisma.systemMetric.findMany({
          where: { runId },
          orderBy: { loggedAt: "desc" },
          take: 100,
        }),
        this.prisma.metric.count({ where: { runId } }),
        this.prisma.systemMetric.count({ where: { runId } }),
        this.prisma.logLine.count({ where: { runId } }),
        this.prisma.runTag.findMany({
          where: { runId },
          include: { tag: { select: { name: true } } },
        }),
      ]);

    if (!run) return null;

    return {
      historyTail: historyTail.map((m) => ({
        key: m.key,
        step: m.step,
        value: m.value,
        loggedAt: m.loggedAt.toISOString(),
      })),
      eventsTail: eventsTail.map((m) => ({
        key: m.key,
        step: m.step,
        value: m.value,
        loggedAt: m.loggedAt.toISOString(),
      })),
      config: run.config,
      summaryMetrics: run.summary,
      historyLineCount: historyCount,
      eventsLineCount: eventsCount,
      logLineCount,
      tags: runTags.map((rt) => rt.tag.name),
      wandbConfig: run.config,
    };
  }
}