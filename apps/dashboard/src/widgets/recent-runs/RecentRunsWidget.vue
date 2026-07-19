<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import { LCard, LButton, LSkeleton, LEmpty, LTag } from "@lumina/ui";
import { useRuns } from "@/modules/run/composables/useRuns";
import { useCurrentProject } from "@/composables/useCurrentProject";
import { useRealtimeSubscription } from "@/composables/useRealtimeSubscription";
import RunStatusBadge from "@/widgets/run-status-badge/RunStatusBadge.vue";
import { useDateFormat } from "@/composables/useDateFormat";

const projectId = useCurrentProject();
const { formatDate } = useDateFormat();
const queryClient = useQueryClient();

// Subscribe to workspace-wide run lifecycle events so a freshly logged
// metric appears in this widget without a page reload. Closes the §5 gap
// in `docs/User-Lifecycle-Flow-Audit.md` — WorkspaceOverview was the
// only top-level view still offline after Phase 2.
useRealtimeSubscription(
  computed(() => "workspace:default"),
  (event) => {
    if (event.type === "RunCreated" || event.type === "RunFinished") {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    }
  },
);

// When a project is selected, scope to it. Otherwise show the global
// recent runs feed.
const queryParams = computed(() => ({
  limit: 5,
  ...(projectId.value ? { project: projectId.value } : {}),
}));

const { data: runs, isLoading } = useRuns(queryParams);
const recentRuns = computed(() => runs.value?.items ?? []);
</script>

<template>
  <LCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-medium">
          {{ projectId ? "Recent Runs (this project)" : "Recent Runs" }}
        </h3>
        <LTag v-if="projectId" size="small" type="info">Scoped</LTag>
      </div>
    </template>

    <div v-if="isLoading" class="space-y-2 p-2">
      <LSkeleton v-for="i in 3" :key="i" text />
    </div>

    <div v-else-if="recentRuns.length === 0" class="p-2">
      <LEmpty
        size="small"
        :title="projectId ? 'No runs in this project yet' : 'No runs yet'"
        :description="
          projectId
            ? 'Switch to a different project or start a run from your SDK.'
            : 'Run an experiment from the Python SDK to see data here.'
        "
      />
    </div>

    <ul v-else class="divide-y divide-border">
      <li
        v-for="run in recentRuns"
        :key="run.runId"
        class="hover:bg-canvas"
      >
        <RouterLink
          :to="`/projects/${run.projectId}/runs/${run.runId}`"
          class="flex items-center justify-between gap-3 px-4 py-2 text-sm"
        >
          <div class="flex min-w-0 items-center gap-3">
            <RunStatusBadge :status="run.status" />
            <div class="min-w-0">
              <div class="truncate font-medium">{{ run.name }}</div>
              <div class="font-mono text-[11px] text-fg-tertiary">
                {{ formatDate(run.createdAt) }}
              </div>
            </div>
          </div>
          <LButton size="sm" text>View</LButton>
        </RouterLink>
      </li>
    </ul>
  </LCard>
</template>
