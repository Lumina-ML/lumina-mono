import { fetchApi } from "./api";
import type {
  RegistryModel,
  RegistryModelVersion,
  CreateRegistryModelInput,
  ListRegistryModelsQuery,
} from "@/types/registry-model";
import type { PaginatedResponse } from "@/types/project";

export const RegistryService = {
  list(params?: ListRegistryModelsQuery): Promise<PaginatedResponse<RegistryModel>> {
    return fetchApi(`/api/v1/registry-models`, { params });
  },

  get(modelId: string): Promise<RegistryModel> {
    return fetchApi(`/api/v1/registry-models/${modelId}`);
  },

  create(data: CreateRegistryModelInput): Promise<RegistryModel> {
    return fetchApi(`/api/v1/registry-models`, { method: "POST", body: data });
  },

  listVersions(modelId: string): Promise<RegistryModelVersion[]> {
    return fetchApi(`/api/v1/registry-models/${modelId}/versions`);
  },

  createVersion(modelId: string, artifactVersionId: string, aliases: string[] = []) {
    return fetchApi(`/api/v1/registry-models/${modelId}/versions`, {
      method: "POST",
      body: { artifactVersionId, aliases },
    });
  },
};