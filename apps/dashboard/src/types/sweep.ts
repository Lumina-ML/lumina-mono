export type SweepMethod = "random" | "grid" | "bayes";
export type SweepState = "pending" | "running" | "finished" | "crashed" | "cancelled";

export interface Sweep {
  id: string;
  projectId: string;
  name: string;
  state: SweepState;
  method: SweepMethod;
  config: Record<string, unknown>;
  bestRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSweepInput {
  name: string;
  method?: SweepMethod;
  config: Record<string, unknown>;
}

export interface UpdateSweepInput {
  state?: SweepState;
  bestRunId?: string | null;
  config?: Record<string, unknown>;
}

export interface ListSweepsQuery {
  projectId?: string;
  state?: SweepState;
  limit?: number;
  offset?: number;
}