export type EvaluationStatus = "pending" | "running" | "completed" | "failed";

export interface Evaluation {
  id: string;
  projectId: string;
  name: string;
  status: EvaluationStatus;
  runId: string | null;
  datasetArtifactVersionId: string | null;
  modelArtifactVersionId: string | null;
  summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationResult {
  id: string;
  evaluationId: string;
  key: string;
  value: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateEvaluationInput {
  name: string;
  runId?: string;
  datasetArtifactVersionId?: string;
  modelArtifactVersionId?: string;
  metadata?: Record<string, unknown>;
}

export interface PatchEvaluationInput {
  status?: EvaluationStatus;
  summary?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ListEvaluationsQuery {
  projectId?: string;
  status?: EvaluationStatus;
  limit?: number;
  offset?: number;
}