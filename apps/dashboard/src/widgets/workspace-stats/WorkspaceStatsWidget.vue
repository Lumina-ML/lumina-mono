<script setup lang="ts">
import { computed } from "vue";
import { FolderKanban, PlayCircle, Box, Activity } from "lucide-vue-next";
import { LCard, LStatistic } from "@lumina/ui";
import { useWorkspaceStats } from "@/widgets/workspace-stats/useWorkspaceStats";

const { projectsTotal, runsTotal, activeRuns, artifactsTotal } = useWorkspaceStats();

const stats = computed(() => [
  { label: "Projects", value: projectsTotal.value, icon: FolderKanban },
  { label: "Total Runs", value: runsTotal.value, icon: PlayCircle },
  { label: "Active Runs", value: activeRuns.value, icon: Activity },
  { label: "Artifacts", value: artifactsTotal.value, icon: Box },
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
