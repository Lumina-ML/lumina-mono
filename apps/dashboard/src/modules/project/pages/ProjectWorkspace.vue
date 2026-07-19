<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import { useProject } from "@/modules/project/composables/useProjects";
import { useRuns } from "@/modules/run/composables/useRuns";
import RunStatusBadge from "@/widgets/run-status-badge/RunStatusBadge.vue";
import { useDateFormat } from "@/composables/useDateFormat";
import { useRealtimeSubscription } from "@/composables/useRealtimeSubscription";
import { ArrowRight, Activity, GitBranch, Package } from "lucide-vue-next";
import { LCard, LEmpty } from "@lumina/ui";

const route = useRoute();
const queryClient = useQueryClient();
const projectId = computed(() => route.params.projectId as string);
const { data: project } = useProject(projectId);
const { formatDate } = useDateFormat();

const { data: runsResponse, isLoading: runsLoading } = useRuns(
  computed(() => ({
    project: project.value?.name,
    limit: 8,
    offset: 0,
  })),
);

const recentRuns = computed(() => runsResponse.value?.items ?? []);

// Refresh runs + artifacts lists whenever a RunCreated/ArtifactUploaded event
// fires for this project. This gives the workspace header instant feedback
// when new work lands.
useRealtimeSubscription(
  computed(() => `project:${projectId.value}`),
  (event) => {
    switch (event.type) {
      case "RunCreated":
        queryClient.invalidateQueries({ queryKey: ["runs"] });
        break;
      case "ArtifactUploaded":
        queryClient.invalidateQueries({ queryKey: ["artifacts"] });
        break;
      default:
        break;
    }
  },
);
</script>

<template>
  <div class="space-y-6">
    <LCard title="Recent Runs" class="p-0">
      <div v-if="runsLoading" class="p-6 text-center text-sm text-fg-tertiary">
        Loading…
      </div>
      <LEmpty
        v-else-if="recentRuns.length === 0"
        title="No runs yet"
        description="Start a training run with the Lumina SDK to see it appear here."
        class="py-12"
      />
      <ul v-else class="divide-y divide-border">
        <li
          v-for="run in recentRuns"
          :key="run.id"
          class="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-canvas"
        >
          <div class="flex min-w-0 items-center gap-3">
            <RunStatusBadge :status="run.status" />
            <RouterLink
              :to="`/projects/${projectId}/runs/${run.runId}`"
              class="truncate font-medium hover:underline"
            >
              {{ run.name }}
            </RouterLink>
            <span class="font-mono text-xs text-fg-tertiary">
              {{ formatDate(run.createdAt) }}
            </span>
          </div>
          <RouterLink
            :to="`/projects/${projectId}/runs/${run.runId}`"
            class="flex items-center gap-1 text-xs text-fg-tertiary hover:text-fg-primary"
          >
            Open
            <ArrowRight class="h-3 w-3" />
          </RouterLink>
        </li>
      </ul>
    </LCard>

    <div class="grid gap-4 sm:grid-cols-3">
      <LCard class="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
              Runs
            </div>
            <div class="mt-2 font-mono text-2xl">
              {{ runsResponse?.total ?? "—" }}
            </div>
          </div>
          <Activity class="h-5 w-5 text-fg-tertiary" />
        </div>
        <RouterLink
          :to="`/projects/${projectId}/runs`"
          class="mt-3 inline-flex items-center gap-1 text-xs text-accent-primary hover:underline"
        >
          View all
          <ArrowRight class="h-3 w-3" />
        </RouterLink>
      </LCard>

      <LCard class="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
              Sweeps
            </div>
            <div class="mt-2 font-mono text-2xl">—</div>
          </div>
          <GitBranch class="h-5 w-5 text-fg-tertiary" />
        </div>
        <RouterLink
          :to="`/projects/${projectId}/sweeps`"
          class="mt-3 inline-flex items-center gap-1 text-xs text-accent-primary hover:underline"
        >
          View all
          <ArrowRight class="h-3 w-3" />
        </RouterLink>
      </LCard>

      <LCard class="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
              Artifacts
            </div>
            <div class="mt-2 font-mono text-2xl">—</div>
          </div>
          <Package class="h-5 w-5 text-fg-tertiary" />
        </div>
        <RouterLink
          :to="`/projects/${projectId}/artifacts`"
          class="mt-3 inline-flex items-center gap-1 text-xs text-accent-primary hover:underline"
        >
          View all
          <ArrowRight class="h-3 w-3" />
        </RouterLink>
      </LCard>
    </div>
  </div>
</template>