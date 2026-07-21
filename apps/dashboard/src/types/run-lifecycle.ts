/**
 * Types for run lifecycle endpoints that sit alongside the core `run` module:
 * rewind, resume-state, stop-signal, alerts, and use-artifact.
 */

export interface RewindRunInput {
  metricName: string;
  metricValue: number;
  programPath?: string;
}

export interface ResumeMetricTail {
  key: string;
  step: number;
  value: number;
  loggedAt: string;
}

export interface ResumeState {
  historyTail: ResumeMetricTail[];
  eventsTail: ResumeMetricTail[];
  config: Record<string, unknown>;
  summaryMetrics: Record<string, unknown>;
  historyLineCount: number;
  eventsLineCount: number;
  logLineCount: number;
  tags: string[];
  wandbConfig: Record<string, unknown>;
}

export type RunAlertLevel = "INFO" | "WARN" | "ERROR";

export interface CreateRunAlertInput {
  title: string;
  text: string;
  level?: RunAlertLevel;
  waitDuration?: number;
}

export interface RunAlert {
  alertId: string;
  runId: string;
  level: RunAlertLevel;
  createdAt: string;
}

export interface RecordUseArtifactInput {
  artifactVersionId: string;
  type?: string;
}

export interface RecordUseArtifactResponse {
  runId: string;
  useArtifactId: string;
  artifactVersionId: string;
  createdAt: string;
}

export interface ShouldStopResponse {
  shouldStop: boolean;
}
