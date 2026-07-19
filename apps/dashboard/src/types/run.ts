/**
 * Run status values mirror `apps/server/src/modules/run/schema.ts#RunStatusSchema`.
 * `preempting` is what the SDK writes via `run.mark_preempting()` and the
 * dashboard writes when the user clicks "Preempt" — distinct from `killed`
 * (hard stop) so watchers can distinguish "asked to stop" from "force killed".
 */
export type RunStatus =
  | "pending"
  | "running"
  | "finished"
  | "failed"
  | "crashed"
  | "killed"
  | "preempting";

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
  /** Free-form notes. Send `null` to clear existing notes. */
  notes?: string | null;
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
