import { fetchApi } from "./api";
import type { Sweep, CreateSweepInput, UpdateSweepInput, ListSweepsQuery } from "@/types/sweep";
import type { PaginatedResponse } from "@/types/project";

export interface SweepObservation {
  trial: string;
  metric: Record<string, number>;
  goal?: string;
  attributes?: Record<string, unknown>;
}

export interface SweepSuggestResponse {
  parameters: Record<string, unknown>;
}

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

  listObservations(sweepId: string): Promise<SweepObservation[]> {
    return fetchApi(`/api/v1/sweeps/${sweepId}/observations`);
  },

  suggest(sweepId: string): Promise<SweepSuggestResponse> {
    return fetchApi(`/api/v1/sweeps/${sweepId}/suggest`, {
      method: "POST",
      body: {},
    });
  },

  shouldTerminate(
    sweepId: string,
    trialRunId: string,
  ): Promise<{ shouldTerminate: boolean; reason?: string }> {
    return fetchApi(`/api/v1/sweeps/${sweepId}/should-terminate`, {
      method: "POST",
      body: { trialRunId },
    });
  },

  recordBestRun(
    sweepId: string,
    payload: { runId: string; metric: number; goal?: string },
  ): Promise<{ bestRunId: string }> {
    return fetchApi(`/api/v1/sweeps/${sweepId}/record-best`, {
      method: "POST",
      body: payload,
    });
  },
};
