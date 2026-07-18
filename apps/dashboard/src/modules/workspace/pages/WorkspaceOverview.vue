<script setup lang="ts">
import { computed, ref } from "vue";
import { NStatistic } from "naive-ui";
import { LCard, LButton, LSkeleton } from "@lumina/ui";
import { FolderKanban, PlayCircle, Box, Activity } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { useProjects } from "@/modules/project/composables/useProjects";
import { useRuns } from "@/modules/run/composables/useRuns";

const { data: projects } = useProjects(ref({ limit: 100 }));
const { data: runs, isLoading: isRunsLoading } = useRuns(ref({ limit: 100 }));

const activeRuns = computed(() => runs.value?.items.filter((r) => r.status === "running").length ?? 0);
const recentRuns = computed(() => (runs.value?.items ?? []).slice(0, 5));
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Workspace Overview</h1>
      <p class="text-muted-foreground">Welcome to Lumina — your AI/ML control plane.</p>
    </div>

    <div class="flex flex-wrap gap-4">
      <LCard>
        <NStatistic label="Projects" :value="projects?.total ?? 0">
          <template #prefix>
            <FolderKanban class="w-4 h-4 inline" />
          </template>
        </NStatistic>
      </LCard>
      <LCard>
        <NStatistic label="Total Runs" :value="runs?.total ?? 0">
          <template #prefix>
            <PlayCircle class="w-4 h-4 inline" />
          </template>
        </NStatistic>
      </LCard>
      <LCard>
        <NStatistic label="Active Runs" :value="activeRuns">
          <template #prefix>
            <Activity class="w-4 h-4 inline" />
          </template>
        </NStatistic>
      </LCard>
      <LCard>
        <NStatistic label="Artifacts" :value="0">
          <template #prefix>
            <Box class="w-4 h-4 inline" />
          </template>
        </NStatistic>
      </LCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <LCard title="Recent Runs">
        <div v-if="isRunsLoading" class="space-y-2">
          <LSkeleton text :repeat="3" />
        </div>
        <div v-else-if="recentRuns.length === 0" class="text-muted-foreground py-4">
          No runs yet. Run an experiment to see data here.
        </div>
        <div v-else class="space-y-2">
          <RouterLink
            v-for="run in recentRuns"
            :key="run.runId"
            :to="`/runs/${run.runId}`"
            class="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors"
          >
            <div>
              <div class="font-medium">{{ run.name }}</div>
              <div class="text-xs text-muted-foreground">{{ run.status }}</div>
            </div>
            <LButton size="sm">View</LButton>
          </RouterLink>
        </div>
      </LCard>

      <LCard title="Quick Start">
        <p class="text-muted-foreground mb-4">
          Run an experiment with the Python SDK to see data here.
        </p>
        <pre class="bg-muted p-3 rounded-md text-sm overflow-x-auto">
import lumina
lumina.init(project='demo', name='exp-001')
lumina.log({'loss': 0.9, 'acc': 0.1}, step=0)
lumina.finish()
        </pre>
        <template #footer>
          <RouterLink to="/projects">
            <LButton type="primary">View Projects</LButton>
          </RouterLink>
        </template>
      </LCard>
    </div>
  </div>
</template>
