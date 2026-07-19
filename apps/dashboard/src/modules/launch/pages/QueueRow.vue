<script setup lang="ts">
import { computed } from "vue";
import {
  LStatusBadge,
  LSkeleton,
} from "@lumina/ui";
import { Rocket } from "lucide-vue-next";
import { useLaunchRunsByQueue } from "@/modules/launch/composables/useLaunch";
import { useDateFormat } from "@/composables/useDateFormat";
import type { LaunchQueue, LaunchRun, LaunchRunStatus } from "@/services/launch.service";

const props = defineProps<{
  queue: LaunchQueue;
}>();

const queueId = computed(() => props.queue.id);
const { data: runs, isLoading } = useLaunchRunsByQueue(queueId);
const { formatDate } = useDateFormat();

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
      <span class="font-mono text-xs text-fg-tertiary">
        created {{ formatDate(queue.createdAt) }}
      </span>
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
          </div>
          <span class="font-mono text-[10px] text-fg-tertiary">
            {{ formatDate(r.createdAt) }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>