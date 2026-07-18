import { fetchApi } from "./api";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsQuery,
  PaginatedResponse,
} from "@/types/project";

export const ProjectService = {
  list(params?: ListProjectsQuery): Promise<PaginatedResponse<Project>> {
    return fetchApi("/api/v1/projects", { params });
  },

  get(id: string): Promise<Project> {
    return fetchApi(`/api/v1/projects/${id}`);
  },

  create(data: CreateProjectInput): Promise<Project> {
    return fetchApi("/api/v1/projects", { method: "POST", body: data });
  },

  update(id: string, data: UpdateProjectInput): Promise<Project> {
    return fetchApi(`/api/v1/projects/${id}`, { method: "PATCH", body: data });
  },

  delete(id: string): Promise<void> {
    return fetchApi(`/api/v1/projects/${id}`, { method: "DELETE" });
  },
};
