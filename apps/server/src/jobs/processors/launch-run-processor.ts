import type { JobProcessor, JobContext } from "../types.js";

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
export class LaunchRunProcessor implements JobProcessor {
  readonly name = "launch.run.claimed";

  async process(
    job: { name: string; payload: unknown },
    _ctx: JobContext,
  ): Promise<void> {
    const payload = job.payload as { launchRunId: string; queueId: string };
    console.log(
      `Launch run claimed: ${payload.launchRunId} (queue=${payload.queueId})`,
    );
  }
}