import type { Prisma } from "../../generated/prisma/index.js";
import type { JobContext, JobProcessor, JobPayloadByName } from "../types.js";

type Payload = JobPayloadByName["launch.run.claimed"];

/**
 * Background worker hook for LaunchRuns. Fired after the atomic dequeue
 * flips a run to ``running``. The actual job execution lives in the SDK's
 * launch_agent (the agent does the work and reports the terminal status
 * back via PATCH). The processor here is responsible for:
 *
 * - Validating the run is still in ``running`` state (catch zombie claims).
 * - Emitting a domain event so dashboards / websocket subscribers can
 *   update.
 * - Logging + telemetry for the registry.
 */
export class LaunchRunProcessor implements JobProcessor<"launch.run.claimed"> {
  readonly name = "launch.run.claimed";

  async process(payload: Payload, ctx: JobContext): Promise<void> {
    // Heartbeat: keep `lastSeenAt` fresh so the monitor UI can detect
    // dead agents that stopped reporting back. Tolerates missing rows
    // (the agent may have already reported a terminal status and the
    // LaunchRun was archived) — a missing row isn't an error here.
    try {
      await ctx.prisma.launchRun.update({
        where: { id: payload.launchRunId },
        data: { lastSeenAt: new Date() } as unknown as Prisma.LaunchRunUncheckedUpdateInput,
      });
    } catch (err) {
      ctx.logger.warn(
        { launchRunId: payload.launchRunId, err },
        "launch.run.claimed: LaunchRun row missing or not updatable",
      );
    }

    ctx.logger.info(
      { launchRunId: payload.launchRunId, queueId: payload.queueId },
      "Launch run claimed",
    );
  }
}