import { fetchApi } from "./api";
import type {
  RegistryModel,
  RegistryModelVersion,
  CreateRegistryModelInput,
  PatchRegistryModelVersionInput,
  ListRegistryModelsQuery,
} from "@/types/registry-model";
import type { PaginatedResponse } from "@/types/project";

export const RegistryService = {
  list(params?: ListRegistryModelsQuery): Promise<PaginatedResponse<RegistryModel>> {
    // Server mounts `GET /api/v1/projects/:projectId/registry-models` for
    // project-scoped listing; falls back to `/registry-models` when no
    // projectId is supplied (no global list route today, see gap report).
    const { projectId, ...rest } = params ?? {};
    const path = projectId
      ? `/api/v1/projects/${projectId}/registry-models`
      : `/api/v1/projects/_/registry-models`;
    return fetchApi(path, { params: rest });
  },

  get(modelId: string): Promise<RegistryModel> {
    return fetchApi(`/api/v1/registry-models/${modelId}`);
  },

  /**
   * Server expects `POST /api/v1/projects/:projectId/registry-models`. The
   * previous implementation posted to `/registry-models` which 404s. Caller
   * must supply the projectId — there is no project-less fallback.
   */
  create(projectId: string, data: CreateRegistryModelInput): Promise<RegistryModel> {
    return fetchApi(`/api/v1/projects/${projectId}/registry-models`, {
      method: "POST",
      body: data,
    });
  },

  listVersions(modelId: string): Promise<RegistryModelVersion[]> {
    return fetchApi(`/api/v1/registry-models/${modelId}/versions`);
  },

  getVersion(versionId: string): Promise<RegistryModelVersion> {
    return fetchApi(`/api/v1/registry-model-versions/${versionId}`);
  },

  createVersion(modelId: string, artifactVersionId: string, aliases: string[] = []) {
    return fetchApi(`/api/v1/registry-models/${modelId}/versions`, {
      method: "POST",
      body: { artifactVersionId, aliases },
    });
  },

  patchVersion(
    versionId: string,
    data: PatchRegistryModelVersionInput,
  ): Promise<RegistryModelVersion> {
    return fetchApi(`/api/v1/registry-model-versions/${versionId}`, {
      method: "PATCH",
      body: data,
    });
  },
};
