import { useQuery } from "@tanstack/vue-query";
import { ProjectService } from "@/services/project.service";
import type { ListProjectsQuery } from "@/types/project";
import type { Ref } from "vue";

export function useProjects(params?: Ref<ListProjectsQuery>) {
  return useQuery({
    queryKey: ["projects", params?.value],
    queryFn: () => ProjectService.list(params?.value),
  });
}

export function useProject(projectId: Ref<string>) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => ProjectService.get(projectId.value),
    enabled: () => !!projectId.value,
  });
}
