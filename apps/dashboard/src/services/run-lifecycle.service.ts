import { fetchApi } from "./api";
import type {
  RewindRunInput,
  ResumeState,
  CreateRunAlertInput,
  RunAlert,
  RecordUseArtifactInput,
  RecordUseArtifactResponse,
  ShouldStopResponse,
} from "@/types/run-lifecycle";

/**
 * Run lifecycle operations that live outside the core `RunService`:
 * rewind, resume-state, stop-signal, alerts, and use-artifact.
 */
export const RunLifecycleService = {
  /**
   * Rewind a run's metric history to the last point where `metricName`
   * equalled `metricValue`. Returns the resumable state so the SDK can
   * continue without an extra round-trip.
   */
  rewindRun(runId: string, data: RewindRunInput): Promise<ResumeState> {
    return fetchApi(`/api/v1/runs/${runId}/rewind`, {
      method: "POST",
      body: data,
    });
  },

  /**
   * Fetch the tail data and run state needed to resume a training job.
   */
  getResumeState(runId: string): Promise<ResumeState> {
    return fetchApi(`/api/v1/runs/${runId}/resume-state`);
  },

  /**
   * Poll whether a stop signal has been requested for this run. The signal
   * is set via `RunService.update(runId, { metadata: { stopRequested: true } })`.
   */
  shouldStop(runId: string): Promise<ShouldStopResponse> {
    return fetchApi(`/api/v1/runs/${runId}/should-stop`);
  },

  /**
   * Record a run alert (INFO/WARN/ERROR).
   */
  sendAlert(runId: string, data: CreateRunAlertInput): Promise<RunAlert> {
    return fetchApi(`/api/v1/runs/${runId}/alerts`, {
      method: "POST",
      body: data,
    });
  },

  /**
   * Record that a run referenced an artifact version (input/output/job/etc.).
   */
  useArtifact(
    runId: string,
    data: RecordUseArtifactInput,
  ): Promise<RecordUseArtifactResponse> {
    return fetchApi(`/api/v1/runs/${runId}/use-artifact`, {
      method: "POST",
      body: data,
    });
  },
};
