<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import { LSkeleton, LTabs, LTabPane, LTag, LTooltip } from "@lumina/ui";
import { LCard, LButton } from "@lumina/ui";
import { Calendar, Clock, Wifi, WifiOff } from "lucide-vue-next";
import { useRun } from "@/modules/run/composables/useRuns";
import { useMetrics } from "@/modules/metric/composables/useMetrics";
import { useSystemMetrics } from "@/modules/metric/composables/useSystemMetrics";
import { useLogLines } from "@/modules/log-line/composables/useLogLines";
import { useRunTags } from "@/modules/run/composables/useTags";
import MetricChart from "@/widgets/metric-chart/MetricChart.vue";
import LogViewer from "@/widgets/log-viewer/LogViewer.vue";
import TagList from "@/widgets/tag-list/TagList.vue";
import { useDateFormat } from "@/composables/useDateFormat";
import { useAutoRefresh } from "@/composables/useAutoRefresh";
import { useRealtimeSubscription } from "@/composables/useRealtimeSubscription";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import type { LogLevel } from "@/types/log-line";

const route = useRoute();
const queryClient = useQueryClient();
const runId = computed(() => route.params.runId as string);

const { data: run, isLoading: isRunLoading, refetch: refetchRun } = useRun(runId);
const { data: metrics, isLoading: isMetricsLoading, refetch: refetchMetrics } = useMetrics(runId);
const { data: systemMetrics, isLoading: isSystemMetricsLoading, refetch: refetchSystemMetrics } = useSystemMetrics(runId);
const { data: logLines, isLoading: isLogsLoading, refetch: refetchLogs } = useLogLines(runId);
const { data: runTags, isLoading: isTagsLoading, refetch: refetchTags } = useRunTags(runId);

const { formatDate, formatDurationMs } = useDateFormat();

const logLevelFilter = ref<LogLevel | null>(null);

// Subscribe to run:<runId> for live updates. The 5s polling loop is gone —
// the WS push invalidates each query and TanStack Query refetches in the
// background (or returns cached data immediately if the request is in-flight).
const { status: wsStatus } = useRealtimeSubscription(
  computed(() => `run:${runId.value}`),
  (event) => {
    switch (event.type) {
      case "MetricLogged":
        queryClient.invalidateQueries({ queryKey: ["metrics", runId.value] });
        queryClient.invalidateQueries({
          queryKey: ["systemMetrics", runId.value],
        });
        queryClient.invalidateQueries({ queryKey: ["run", runId.value] });
        break;
      case "RunFinished":
        queryClient.invalidateQueries({ queryKey: ["run", runId.value] });
        queryClient.invalidateQueries({ queryKey: ["metrics", runId.value] });
        queryClient.invalidateQueries({ queryKey: ["logLines", runId.value] });
        break;
      default:
        break;
    }
  },
);

// Fallback: when the WS is closed/errored and the run is still running,
// keep polling so the UI doesn't go stale.
const isRunning = computed(() => run.value?.status === "running");
useAutoRefresh(
  computed(() => isRunning.value && wsStatus.value !== "open"),
  5000,
  () => {
    refetchRun();
    refetchMetrics();
    refetchSystemMetrics();
    refetchLogs();
    refetchTags();
  },
);

const durationMs = computed(() => {
  if (!run.value) return 0;
  const end = run.value.finishedAt ? new Date(run.value.finishedAt).getTime() : Date.now();
  return end - new Date(run.value.createdAt).getTime();
});

const metricKeys = computed(() => (metrics.value ? Object.keys(metrics.value.metrics) : []));
const selectedKeys = ref<string[]>([]);

watch(
  metricKeys,
  (keys) => {
    if (selectedKeys.value.length === 0 && keys.length > 0) {
      selectedKeys.value = keys.slice(0, 5);
    }
  },
  { immediate: true },
);

const filteredMetrics = computed(() => {
  if (!metrics.value) return {};
  const result: Record<string, typeof metrics.value.metrics[string]> = {};
  for (const key of selectedKeys.value) {
    if (metrics.value.metrics[key]) {
      result[key] = metrics.value.metrics[key];
    }
  }
  return result;
});

function toggleKey(key: string) {
  if (selectedKeys.value.includes(key)) {
    selectedKeys.value = selectedKeys.value.filter((k) => k !== key);
  } else {
    selectedKeys.value = [...selectedKeys.value, key];
  }
}
</script>

<template>
  <div v-if="isRunLoading" class="space-y-6">
    <LSkeleton text :repeat="3" />
  </div>

  <div v-else-if="!run" class="text-center py-12">
    <p class="text-muted-foreground">Run not found.</p>
  </div>

  <div v-else class="space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="space-y-2">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold tracking-tight">{{ run.name }}</h1>
          <LTag :type="run.status === 'running' ? 'warning' : run.status === 'finished' ? 'success' : 'error'" round>
            {{ run.status }}
          </LTag>
        </div>
        <div class="flex items-center gap-4 text-sm text-muted-foreground">
          <RouterLink :to="`/projects/${run.projectId}`" class="hover:underline">
            {{ run.projectId }}
          </RouterLink>
          <span class="flex items-center gap-1">
            <Calendar class="w-4 h-4" />
            {{ formatDate(run.createdAt) }}
          </span>
          <span class="flex items-center gap-1">
            <Clock class="w-4 h-4" />
            {{ formatDurationMs(durationMs) }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <LTooltip
          :content="
            wsStatus === 'open'
              ? 'Live updates via WebSocket'
              : wsStatus === 'connecting'
                ? 'Connecting to live updates…'
                : 'Live updates unavailable — using polling fallback'
          "
        >
          <span
            :class="[
              'flex h-7 w-7 items-center justify-center rounded-full',
              wsStatus === 'open'
                ? 'bg-accent-success/15 text-accent-success'
                : wsStatus === 'connecting'
                  ? 'bg-accent-warning/15 text-accent-warning'
                  : 'bg-canvas text-fg-tertiary',
            ]"
            :aria-label="`WebSocket status: ${wsStatus}`"
          >
            <Wifi v-if="wsStatus === 'open'" class="h-3.5 w-3.5" />
            <WifiOff v-else class="h-3.5 w-3.5" />
          </span>
        </LTooltip>
        <LButton size="sm" @click="refetchRun()">Refresh</LButton>
      </div>
    </div>

    <!-- Tabs -->
    <LTabs type="line" animated>
      <LTabPane name="metrics" tab="Metrics">
        <LCard>
          <div v-if="isMetricsLoading" class="py-12 text-center text-muted-foreground">
            Loading metrics...
          </div>
          <div v-else-if="metricKeys.length === 0" class="py-12 text-center text-muted-foreground">
            No metrics logged yet.
          </div>
          <div v-else class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <LTag
                v-for="key in metricKeys"
                :key="key"
                :type="selectedKeys.includes(key) ? 'primary' : 'default'"
                size="small"
                class="cursor-pointer"
                @click="toggleKey(key)"
              >
                {{ key }}
              </LTag>
            </div>
            <MetricChart :metrics="filteredMetrics" />
          </div>
        </LCard>
      </LTabPane>

      <LTabPane name="system" tab="System">
        <LCard>
          <div v-if="isSystemMetricsLoading" class="py-12 text-center text-muted-foreground">
            Loading system metrics...
          </div>
          <div v-else-if="!systemMetrics || Object.keys(systemMetrics.metrics).length === 0" class="py-12 text-center text-muted-foreground">
            No system metrics logged yet.
          </div>
          <MetricChart v-else :metrics="systemMetrics.metrics" />
        </LCard>
      </LTabPane>

      <LTabPane name="logs" tab="Logs">
        <LCard>
          <LogViewer
            :logs="logLines?.logs ?? []"
            :loading="isLogsLoading"
            v-model:level="logLevelFilter"
          />
        </LCard>
      </LTabPane>

      <LTabPane name="tags" tab="Tags">
        <LCard title="Run Tags">
          <TagList :tags="runTags?.items ?? []" :loading="isTagsLoading" />
        </LCard>
      </LTabPane>

      <LTabPane name="config" tab="Config">
        <LCard title="Run Config">
          <VueJsonPretty :data="run.config" :deep="3" />
        </LCard>
      </LTabPane>
    </LTabs>
  </div>
</template>
