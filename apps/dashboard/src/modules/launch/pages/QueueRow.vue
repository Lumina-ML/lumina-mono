<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import {
  LStatusBadge,
  LSkeleton,
  LButton,
  LIconButton,
} from "@lumina/ui";
import { Rocket, XCircle, RotateCcw, Download } from "lucide-vue-next";
import { useLaunchRunsByQueue } from "@/modules/launch/composables/useLaunch";
import { LaunchService } from "@/services/launch.service";
import { useDateFormat } from "@/composables/useDateFormat";
import { useToast } from "@/composables/useToast";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import type { LaunchQueue, LaunchRun, LaunchRunStatus } from "@/services/launch.service";

const props = defineProps<{
  queue: LaunchQueue;
}>();

const queueId = computed(() => props.queue.id);
const { data: runs, isLoading } = useLaunchRunsByQueue(queueId);
const { formatDate } = useDateFormat();
const toast = useToast();
const queryClient = useQueryClient();

const patchRunMutation = useMutation({
  mutationFn: ({
    runId,
    status,
  }: {
    runId: string;
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
  }) => LaunchService.patchRun(runId, { status }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["launch-runs"] });
  },
  onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
});

const dequeueMutation = useMutation({
  mutationFn: () => LaunchService.dequeueRun(queueId.value),
  onSuccess: (run) => {
    if (run) {
      toast.success(`Claimed launch run ${run.id.slice(0, 8)}`);
    } else {
      toast.info("Queue is empty");
    }
    queryClient.invalidateQueries({ queryKey: ["launch-runs"] });
  },
  onError: (e) => toast.error(`Dequeue failed: ${(e as Error).message}`),
});

function cancelRun(runId: string) {
  patchRunMutation.mutate({ runId, status: "cancelled" });
}

function retryRun(runId: string) {
  patchRunMutation.mutate({ runId, status: "pending" });
}

const statusCounts = computed(() => {
  const items = (runs.value?.items ?? []) as LaunchRun[];
  const counts: Record<LaunchRunStatus, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const r of items) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
});

const recentRuns = computed(() =>
  ((runs.value?.items ?? []) as LaunchRun[]).slice(0, 5),
);

const totalCount = computed(() => recentRuns.value.length);

const ORDER: LaunchRunStatus[] = [
  "running",
  "pending",
  "failed",
  "completed",
  "cancelled",
];
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Rocket class="h-4 w-4 text-fg-tertiary" />
        <span class="font-medium">{{ queue.name }}</span>
        <span class="font-mono text-[10px] text-fg-tertiary">
          {{ queue.id.slice(0, 8) }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <LButton
          size="xs"
          quaternary
          :loading="dequeueMutation.isPending.value"
          @click="dequeueMutation.mutate()"
        >
          <Download class="mr-1 h-3 w-3" />
          Dequeue
        </LButton>
        <span class="font-mono text-xs text-fg-tertiary">
          created {{ formatDate(queue.createdAt) }}
        </span>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-[11px]">
      <LSkeleton v-if="isLoading" text style="width: 120px" />
      <template v-else>
        <span
          v-for="s in ORDER"
          :key="s"
          v-show="statusCounts[s] > 0"
          class="flex items-center gap-1 rounded-md border border-border bg-canvas px-2 py-0.5 font-mono"
        >
          <LStatusBadge :status="s" size="small" />
          <span>{{ statusCounts[s] }}</span>
        </span>
      </template>
    </div>

    <div
      v-if="totalCount > 0"
      class="rounded-md border border-border bg-canvas p-2"
    >
      <ul class="divide-y divide-border">
        <li
          v-for="r in recentRuns"
          :key="r.id"
          class="flex items-center justify-between gap-2 py-1 text-xs"
        >
          <div class="flex items-center gap-2">
            <LStatusBadge :status="r.status" size="small" />
            <span class="font-mono text-[10px] text-fg-tertiary">
              {{ r.id.slice(0, 8) }}
            </span>
            <RouterLink
              v-if="r.runId"
              :to="`/projects/${queue.projectId}/runs/${r.runId}`"
              class="font-mono text-[10px] text-accent-primary hover:underline"
            >
              {{ r.runId.slice(0, 8) }}
            </RouterLink>
          </div>
          <div class="flex items-center gap-1">
            <LIconButton
              v-if="r.status === 'running' || r.status === 'pending'"
              aria-label="Cancel run"
              size="small"
              @click="cancelRun(r.id)"
            >
              <XCircle class="h-3 w-3" />
            </LIconButton>
            <LIconButton
              v-if="r.status === 'failed' || r.status === 'cancelled'"
              aria-label="Retry run"
              size="small"
              @click="retryRun(r.id)"
            >
              <RotateCcw class="h-3 w-3" />
            </LIconButton>
            <span class="font-mono text-[10px] text-fg-tertiary">
              {{ formatDate(r.createdAt) }}
            </span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>