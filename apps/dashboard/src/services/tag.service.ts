import { fetchApi } from "./api";
import type { Tag, CreateTagInput } from "@/types/tag";
import type { PaginatedResponse } from "@/types/project";

export interface AttachTagByNameInput {
  name: string;
  color?: string;
}

export const TagService = {
  listByProject(projectId: string): Promise<PaginatedResponse<Tag>> {
    return fetchApi(`/api/v1/projects/${projectId}/tags`);
  },

  create(projectId: string, data: CreateTagInput): Promise<Tag> {
    return fetchApi(`/api/v1/projects/${projectId}/tags`, { method: "POST", body: data });
  },

  listByRun(runId: string): Promise<PaginatedResponse<Tag>> {
    return fetchApi(`/api/v1/runs/${runId}/tags`);
  },

  attachToRun(runId: string, data: { tagId: string } | AttachTagByNameInput): Promise<{ success: boolean }> {
    return fetchApi(`/api/v1/runs/${runId}/tags`, { method: "POST", body: data });
  },

  detachFromRun(runId: string, tagId: string): Promise<void> {
    return fetchApi(`/api/v1/runs/${runId}/tags/${tagId}`, { method: "DELETE" });
  },
};
