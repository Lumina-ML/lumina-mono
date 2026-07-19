import { fetchApi } from "./api";
import type {
  RunMedia,
  CreateRunMediaInput,
  ListRunMediaQuery,
} from "@/types/run-media";
import type { PaginatedResponse } from "@/types/project";

export const RunMediaService = {
  list(
    params?: ListRunMediaQuery,
  ): Promise<PaginatedResponse<RunMedia>> {
    const { projectId, ...rest } = params ?? {};
    if (!projectId) {
      // No project-less list route exists; return an empty page to keep
      // callers symmetric with other resources.
      return Promise.resolve({ items: [], total: 0 });
    }
    return fetchApi(`/api/v1/projects/${projectId}/run-media`, { params: rest });
  },

  get(runMediaId: string): Promise<RunMedia> {
    return fetchApi(`/api/v1/run-media/${runMediaId}`);
  },

  create(projectId: string, data: CreateRunMediaInput): Promise<RunMedia> {
    return fetchApi(`/api/v1/projects/${projectId}/run-media`, {
      method: "POST",
      body: data,
    });
  },
};
