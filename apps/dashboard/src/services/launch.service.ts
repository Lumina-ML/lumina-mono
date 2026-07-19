import { fetchApi } from "./api";
import type { PaginatedResponse } from "@/types/project";

export type LaunchRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface LaunchQueue {
  id: string;
  projectId: string;
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  _count?: { runs: number };
}

export interface LaunchJob {
  id: string;
  projectId: string;
  name: string;
  image: string | null;
  command: string[];
  args: string[];
  env: Record<string, string>;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LaunchRun {
  id: string;
  queueId: string;
  jobId: string;
  runId: string | null;
  status: LaunchRunStatus;
  metadata: Record<string, unknown>;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLaunchQueueInput {
  name: string;
  config?: Record<string, unknown>;
}

export const LaunchService = {
  listQueues(
    projectId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<PaginatedResponse<LaunchQueue>> {
    return fetchApi(`/api/v1/projects/${projectId}/launch-queues`, { params });
  },

  createQueue(
    projectId: string,
    data: CreateLaunchQueueInput,
  ): Promise<LaunchQueue> {
    return fetchApi(`/api/v1/projects/${projectId}/launch-queues`, {
      method: "POST",
      body: data,
    });
  },

  listJobs(
    projectId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<PaginatedResponse<LaunchJob>> {
    return fetchApi(`/api/v1/projects/${projectId}/launch-jobs`, { params });
  },

  listRunsByQueue(
    queueId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<PaginatedResponse<LaunchRun>> {
    return fetchApi(`/api/v1/launch-queues/${queueId}/runs`, { params });
  },

  patchRun(runId: string, data: { status?: LaunchRunStatus }): Promise<LaunchRun> {
    return fetchApi(`/api/v1/launch-runs/${runId}`, {
      method: "PATCH",
      body: data,
    });
  },
};