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

export interface CreateLaunchJobInput {
  name: string;
  image?: string;
  command?: string[];
  args?: string[];
  env?: Record<string, string>;
  config?: Record<string, unknown>;
}

export interface CreateLaunchRunInput {
  queueId: string;
  jobId: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}

export interface PatchLaunchRunInput {
  status?: LaunchRunStatus;
  runId?: string;
  metadata?: Record<string, unknown>;
}

export const LaunchService = {
  listQueues(
    projectId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<PaginatedResponse<LaunchQueue>> {
    return fetchApi(`/api/v1/projects/${projectId}/launch-queues`, { params });
  },

  getQueue(queueId: string): Promise<LaunchQueue> {
    return fetchApi(`/api/v1/launch-queues/${queueId}`);
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

  getJob(jobId: string): Promise<LaunchJob> {
    return fetchApi(`/api/v1/launch-jobs/${jobId}`);
  },

  createJob(
    projectId: string,
    data: CreateLaunchJobInput,
  ): Promise<LaunchJob> {
    return fetchApi(`/api/v1/projects/${projectId}/launch-jobs`, {
      method: "POST",
      body: data,
    });
  },

  createRun(
    projectId: string,
    data: CreateLaunchRunInput,
  ): Promise<LaunchRun> {
    return fetchApi(`/api/v1/projects/${projectId}/launch-runs`, {
      method: "POST",
      body: data,
    });
  },

  listRunsByQueue(
    queueId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<PaginatedResponse<LaunchRun>> {
    return fetchApi(`/api/v1/launch-queues/${queueId}/runs`, { params });
  },

  getLaunchRun(runId: string): Promise<LaunchRun> {
    return fetchApi(`/api/v1/launch-runs/${runId}`);
  },

  patchRun(runId: string, data: PatchLaunchRunInput): Promise<LaunchRun> {
    return fetchApi(`/api/v1/launch-runs/${runId}`, {
      method: "PATCH",
      body: data,
    });
  },

  /**
   * Atomic claim of the next pending run for a queue. Returns null when the
   * queue is empty (server replies 204 with no body).
   */
  dequeueRun(queueId: string): Promise<LaunchRun | null> {
    return fetchApi(`/api/v1/launch-queues/${queueId}/dequeue`, {
      method: "POST",
    });
  },
};
