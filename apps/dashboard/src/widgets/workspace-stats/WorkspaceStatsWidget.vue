<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { FolderKanban, PlayCircle, Box, Activity } from "lucide-vue-next";
import { LCard, LStatistic } from "@lumina/ui";
import { useProjects } from "@/modules/project/composables/useProjects";
import { useRuns } from "@/modules/run/composables/useRuns";
import { ArtifactService } from "@/services/artifact.service";

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

const stats = computed(() => [
  { label: "Projects", value: projects.value?.total ?? 0, icon: FolderKanban },
  { label: "Total Runs", value: runs.value?.total ?? 0, icon: PlayCircle },
  { label: "Active Runs", value: activeRuns.value, icon: Activity },
  { label: "Artifacts", value: artifacts.value?.total ?? 0, icon: Box },
]);
</script>

<template>
  <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
    <LCard v-for="stat in stats" :key="stat.label">
      <LStatistic :label="stat.label" :value="stat.value">
        <template #prefix>
          <component :is="stat.icon" class="inline h-4 w-4" />
        </template>
      </LStatistic>
    </LCard>
  </div>
</template>
