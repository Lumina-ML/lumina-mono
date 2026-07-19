/**
 * Mirror of apps/server/src/core/events/domain-event.ts — duplicated here
 * to avoid pulling server modules into the dashboard bundle.
 */

export interface MetricLoggedEvent {
  type: "MetricLogged";
  payload: {
    runId: string;
    projectId: string;
    keys: string[];
    count: number;
  };
}

export interface RunCreatedEvent {
  type: "RunCreated";
  payload: {
    runId: string;
    projectId: string;
  };
}

export interface RunFinishedEvent {
  type: "RunFinished";
  payload: {
    runId: string;
    projectId: string;
    status: string;
  };
}

export interface ArtifactUploadedEvent {
  type: "ArtifactUploaded";
  payload: {
    artifactVersionId: string;
    projectId: string;
    fileCount: number;
  };
}

export type DomainEvent =
  | MetricLoggedEvent
  | RunCreatedEvent
  | RunFinishedEvent
  | ArtifactUploadedEvent;