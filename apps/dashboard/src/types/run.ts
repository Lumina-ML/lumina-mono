export type RunStatus = "pending" | "running" | "finished" | "failed" | "crashed" | "killed";

export interface Run {
  id: string;
  runId: string;
  projectId: string;
  sweepId: string | null;
  name: string;
  status: RunStatus;
  config: Record<string, unknown>;
  summary: Record<string, unknown>;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  _count?: {
    metrics: number;
  };
}

export interface CreateRunInput {
  project: string;
  name: string;
  sweepId?: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateRunInput {
  status?: RunStatus;
  config?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface ListRunsQuery {
  project?: string;
  status?: RunStatus;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  offset?: number;
}
