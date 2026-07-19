export interface DomainEvent {
  type: string;
  payload: unknown;
  occurredAt: Date;
}

export interface MetricLoggedEvent extends DomainEvent {
  type: "MetricLogged";
  payload: {
    runId: string;
    projectId: string;
    keys: string[];
    count: number;
  };
}

export interface RunCreatedEvent extends DomainEvent {
  type: "RunCreated";
  payload: {
    runId: string;
    projectId: string;
  };
}

export interface RunFinishedEvent extends DomainEvent {
  type: "RunFinished";
  payload: {
    runId: string;
    projectId: string;
    status: string;
  };
}

export interface ArtifactUploadedEvent extends DomainEvent {
  type: "ArtifactUploaded";
  payload: {
    artifactVersionId: string;
    projectId: string;
    fileCount: number;
  };
}

export type KnownDomainEvent =
  | MetricLoggedEvent
  | RunCreatedEvent
  | RunFinishedEvent
  | ArtifactUploadedEvent;
