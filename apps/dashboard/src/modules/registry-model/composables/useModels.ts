import { useQuery } from "@tanstack/vue-query";
import { RegistryService } from "@/services/registry.service";
import type { ListRegistryModelsQuery } from "@/types/registry-model";
import type { Ref } from "vue";

export function useModels(params?: Ref<ListRegistryModelsQuery>) {
  return useQuery({
    queryKey: ["registry-models", params?.value],
    queryFn: () => RegistryService.list(params?.value),
  });
}

export function useModel(modelId: Ref<string>) {
  return useQuery({
    queryKey: ["registry-model", modelId],
    queryFn: () => RegistryService.get(modelId.value),
    enabled: () => !!modelId.value,
  });
}

export function useModelVersions(modelId: Ref<string>) {
  return useQuery({
    queryKey: ["registry-model-versions", modelId],
    queryFn: () => RegistryService.listVersions(modelId.value),
    enabled: () => !!modelId.value,
  });
}