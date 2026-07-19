import { fetchApi } from "./api";
import type { Sweep, CreateSweepInput, UpdateSweepInput, ListSweepsQuery } from "@/types/sweep";
import type { PaginatedResponse } from "@/types/project";

export const SweepService = {
  list(params?: ListSweepsQuery): Promise<PaginatedResponse<Sweep>> {
    const { projectId, ...rest } = params ?? {};
    const path = projectId
      ? `/api/v1/projects/${projectId}/sweeps`
      : `/api/v1/sweeps`;
    return fetchApi(path, { params: rest });
  },

  get(sweepId: string): Promise<Sweep> {
    return fetchApi(`/api/v1/sweeps/${sweepId}`);
  },

  create(projectId: string, data: CreateSweepInput): Promise<Sweep> {
    return fetchApi(`/api/v1/projects/${projectId}/sweeps`, {
      method: "POST",
      body: data,
    });
  },

  update(sweepId: string, data: UpdateSweepInput): Promise<Sweep> {
    return fetchApi(`/api/v1/sweeps/${sweepId}`, { method: "PATCH", body: data });
  },

  delete(sweepId: string): Promise<void> {
    return fetchApi(`/api/v1/sweeps/${sweepId}`, { method: "DELETE" });
  },
};