import { useQuery } from "@tanstack/vue-query";
import { PublicApiService } from "@/services/public-api.service";
import type {
  ListPublicRunsQuery,
  ListPublicProjectsQuery,
} from "@/types/public-api";
import type { Ref } from "vue";

export function usePublicRuns(params?: Ref<ListPublicRunsQuery>) {
  return useQuery({
    queryKey: ["public-runs", params?.value],
    queryFn: () => PublicApiService.listRuns(params?.value),
  });
}

export function usePublicProjects(params?: Ref<ListPublicProjectsQuery>) {
  return useQuery({
    queryKey: ["public-projects", params?.value],
    queryFn: () => PublicApiService.listProjects(params?.value),
  });
}
