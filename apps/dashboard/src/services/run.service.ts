import { fetchApi } from "./api";
import type { Run, CreateRunInput, UpdateRunInput, ListRunsQuery } from "@/types/run";
import type { PaginatedResponse } from "@/types/project";

export const RunService = {
  list(params?: ListRunsQuery): Promise<PaginatedResponse<Run>> {
    return fetchApi("/api/v1/runs", { params });
  },

  get(runId: string): Promise<Run> {
    return fetchApi(`/api/v1/runs/${runId}`);
  },

  create(data: CreateRunInput): Promise<Run> {
    return fetchApi("/api/v1/runs", { method: "POST", body: data });
  },

  update(runId: string, data: UpdateRunInput): Promise<Run> {
    return fetchApi(`/api/v1/runs/${runId}`, { method: "PATCH", body: data });
  },

  delete(runId: string): Promise<void> {
    return fetchApi(`/api/v1/runs/${runId}`, { method: "DELETE" });
  },
};
