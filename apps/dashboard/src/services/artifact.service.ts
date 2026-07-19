import { fetchApi } from "./api";
import type {
  Artifact,
  ArtifactVersion,
  CreateArtifactInput,
  ListArtifactsQuery,
} from "@/types/artifact";
import type { PaginatedResponse } from "@/types/project";

export const ArtifactService = {
  list(params?: ListArtifactsQuery): Promise<PaginatedResponse<Artifact>> {
    const { projectId, ...rest } = params ?? {};
    const path = projectId
      ? `/api/v1/projects/${projectId}/artifacts`
      : `/api/v1/artifacts`;
    return fetchApi(path, { params: rest });
  },

  get(artifactId: string): Promise<Artifact> {
    return fetchApi(`/api/v1/artifacts/${artifactId}`);
  },

  create(projectId: string, data: CreateArtifactInput): Promise<Artifact> {
    return fetchApi(`/api/v1/projects/${projectId}/artifacts`, {
      method: "POST",
      body: data,
    });
  },

  listVersions(artifactId: string): Promise<ArtifactVersion[]> {
    return fetchApi(`/api/v1/artifacts/${artifactId}/versions`);
  },
};