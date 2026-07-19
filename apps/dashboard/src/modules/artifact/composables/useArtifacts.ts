import { useQuery } from "@tanstack/vue-query";
import { ArtifactService } from "@/services/artifact.service";
import type { ListArtifactsQuery } from "@/types/artifact";
import type { Ref } from "vue";

export function useArtifacts(params?: Ref<ListArtifactsQuery>) {
  return useQuery({
    queryKey: ["artifacts", params?.value],
    queryFn: () => ArtifactService.list(params?.value),
  });
}

export function useArtifact(artifactId: Ref<string>) {
  return useQuery({
    queryKey: ["artifact", artifactId],
    queryFn: () => ArtifactService.get(artifactId.value),
    enabled: () => !!artifactId.value,
  });
}