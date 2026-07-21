import { fetchApi } from "./api";
import type { Run } from "@/types/run";
import type { Project } from "@/types/project";
import type {
  ListPublicRunsQuery,
  ListPublicProjectsQuery,
} from "@/types/public-api";
import type { PaginatedResponse } from "@/types/project";

/**
 * Public read-only endpoints consumed by the SDK's PublicApi.
 * These require the same API-key auth as the rest of /api/v1 but return
 * a stable, shareable shape.
 */
export const PublicApiService = {
  listRuns(params?: ListPublicRunsQuery): Promise<PaginatedResponse<Run>> {
    return fetchApi("/api/v1/public/runs", { params });
  },

  listProjects(
    params?: ListPublicProjectsQuery,
  ): Promise<PaginatedResponse<Project>> {
    return fetchApi("/api/v1/public/projects", { params });
  },
};
