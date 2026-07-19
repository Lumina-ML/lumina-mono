export type RunMediaType =
  | "table"
  | "image"
  | "video"
  | "audio"
  | "plotly"
  | "html"
  | "file";

export interface RunMedia {
  id: string;
  projectId: string;
  runId: string | null;
  key: string;
  type: RunMediaType;
  artifactVersionId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateRunMediaInput {
  runId?: string;
  key: string;
  type: RunMediaType;
  artifactVersionId: string;
  metadata?: Record<string, unknown>;
}

export interface ListRunMediaQuery {
  projectId?: string;
  runId?: string;
  type?: RunMediaType;
  limit?: number;
  offset?: number;
}
