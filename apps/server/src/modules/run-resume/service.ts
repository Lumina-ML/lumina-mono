import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { TOKENS } from "../../core/di/tokens.js";

/// Tail size for history / events returned in the resume-state payload.
/// The wandb contract used 100 lines per tail; we match that for parity.
const HISTORY_TAIL = 100;
const EVENTS_TAIL = 100;

@injectable()
export class RunResumeService {
  constructor(@inject(TOKENS.PrismaClient) private readonly prisma: PrismaClient) {}

  async getState(runId: string) {
    const [run, historyTail, eventsTail, historyCount, eventsCount, logLineCount, runTags] =
      await Promise.all([
        this.prisma.run.findUnique({
          where: { runId },
          select: {
            config: true,
            summary: true,
            metadata: true,
          },
        }),
        this.prisma.metric.findMany({
          where: { runId },
          orderBy: [{ step: "desc" }, { loggedAt: "desc" }],
          take: HISTORY_TAIL,
        }),
        this.prisma.systemMetric.findMany({
          where: { runId },
          orderBy: { loggedAt: "desc" },
          take: EVENTS_TAIL,
        }),
        this.prisma.metric.count({ where: { runId } }),
        this.prisma.systemMetric.count({ where: { runId } }),
        this.prisma.logLine.count({ where: { runId } }),
        this.prisma.runTag.findMany({
          where: { runId },
          include: { tag: { select: { name: true } } },
          orderBy: { id: "asc" },
        }),
      ]);

    if (!run) return null;

    return {
      // Tail arrays are JSON-serializable (Dates → ISO strings handled in handler).
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
      /// Legacy wandb config alias — currently a passthrough to the main
      /// config. Kept so SDK-side code expecting `wandbConfig` keeps
      /// working unchanged.
      wandbConfig: run.config,
    };
  }
}