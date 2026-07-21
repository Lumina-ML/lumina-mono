import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useProjects } from "@/modules/project/composables/useProjects";
import { useRuns } from "@/modules/run/composables/useRuns";
import { ArtifactService } from "@/services/artifact.service";

/**
 * Workspace-wide KPI strip data (projects / runs / active runs /
 * artifacts). Lives in `composables/` so the
 * `WorkspaceStatsWidget.vue` template stays presentational.
 */
export function useWorkspaceStats() {
  const { data: projects } = useProjects(ref({ limit: 100 }));
  const { data: runs } = useRuns(ref({ limit: 100 }));
  // Artifacts have no project-agnostic endpoint on the server yet, so
  // we ask for `limit=1` and read the paginated `total`. Same trick the
  // server uses to surface dataset/registry counts.
  const { data: artifacts } = useQuery({
    queryKey: ["artifacts", "count"],
    queryFn: () => ArtifactService.list({ limit: 1 }),
    staleTime: 60_000,
  });

  const activeRuns = computed(
    () => runs.value?.items.filter((r) => r.status === "running").length ?? 0,
  );

  return {
    projectsTotal: computed(() => projects.value?.total ?? 0),
    runsTotal: computed(() => runs.value?.total ?? 0),
    activeRuns,
    artifactsTotal: computed(() => artifacts.value?.total ?? 0),
  };
}