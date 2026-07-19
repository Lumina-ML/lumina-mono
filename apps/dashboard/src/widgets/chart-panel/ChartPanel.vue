<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { Pencil, X } from "lucide-vue-next";
import { LCard, LSpinner, LTooltip, LIconButton, LTag } from "@lumina/ui";
import MetricChart from "@/widgets/metric-chart/MetricChart.vue";
import { MetricService } from "@/services/metric.service";
import { RunService } from "@/services/run.service";
import { colorForRunId } from "@/composables/useRunColor";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Run } from "@/types/run";

export interface ChartPanelConfig {
  /** Display title */
  title: string;
  /** Metric keys to chart (one series per run per key) */
  metricKeys: string[];
  /** Optional smoothing window (0 = raw) */
  smoothing?: number;
}

const props = defineProps<{
  config: ChartPanelConfig;
  /** Run IDs whose metrics should be overlaid. */
  runIds: string[];
}>();

const emit = defineEmits<{
  remove: [];
  edit: [];
}>();

const { formatDate } = useDateFormat();

// Fetch each selected run + its metrics in parallel.
const runsQueries = computed(() =>
  props.runIds.map((runId) => ({
    runId,
    queryKey: ["run", runId],
    enabled: () => !!runId,
  })),
);

const { data: runsData, isLoading: runsLoading } = useQuery({
  queryKey: computed(() => ["runs", "for-panel", props.runIds]),
  queryFn: async () => {
    const runs = await Promise.all(
      props.runIds.map((id) => RunService.get(id).catch(() => null)),
    );
    return runs.filter((r): r is Run => !!r);
  },
});

// Fetch metrics for each run. We do this as a single query keyed by runIds so
// TanStack dedupes requests across panels that share runs.
const metricsQueries = computed(() =>
  props.runIds.map((runId) => ({
    runId,
    metricKeys: props.config.metricKeys,
  })),
);

const { data: metricsByRun, isLoading: metricsLoading } = useQuery({
  queryKey: computed(() => [
    "metrics",
    "for-panel",
    props.runIds,
    props.config.metricKeys,
  ]),
  queryFn: async () => {
    const entries = await Promise.all(
      props.runIds.map(async (runId) => {
        try {
          const resp = await MetricService.list(runId, { limit: 5000 });
          return [runId, resp.metrics] as const;
        } catch {
          return [runId, {}] as const;
        }
      }),
    );
    return Object.fromEntries(entries);
  },
});

// Re-run when runIds / metricKeys change.
watch(
  () => [props.runIds.join(","), props.config.metricKeys.join(",")].join("|"),
  () => {
    /* query refetches via key change */
  },
);

const series = computed(() => {
  const out: Array<{
    runId: string;
    name: string;
    color: string;
    metrics: Record<string, Array<{ step: number; value: number }>>;
  }> = [];
  const runs = runsData.value ?? [];
  const metrics = metricsByRun.value ?? {};
  for (const run of runs) {
    const m = metrics[run.runId];
    if (!m) continue;
    out.push({
      runId: run.runId,
      name: run.name,
      color: colorForRunId(run.runId),
      metrics: m,
    });
  }
  return out;
});

const hasData = computed(() => series.value.length > 0);
const loading = computed(() => runsLoading.value || metricsLoading.value);

const summary = computed(() => {
  const runs = runsData.value ?? [];
  if (runs.length === 0) return "";
  const oldest = runs.reduce(
    (a, r) => (new Date(r.createdAt) < new Date(a.createdAt) ? r : a),
    runs[0]!,
  );
  return `${runs.length} runs · since ${formatDate(oldest.createdAt)}`;
});

void metricsQueries;
void runsQueries;
</script>

<template>
  <LCard class="flex h-full flex-col p-0">
    <div class="flex items-start justify-between border-b border-border px-3 py-2">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="truncate text-sm font-medium">{{ config.title }}</h3>
          <LTooltip content="Configure chart">
            <LIconButton aria-label="Configure" size="small" @click="emit('edit')">
              <Pencil class="h-3 w-3" />
            </LIconButton>
          </LTooltip>
          <LTooltip content="Remove panel">
            <LIconButton aria-label="Remove" size="small" @click="emit('remove')">
              <X class="h-3 w-3" />
            </LIconButton>
          </LTooltip>
        </div>
        <p v-if="summary" class="mt-0.5 font-mono text-[10px] text-fg-tertiary">
          {{ summary }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-1">
        <LTag
          v-for="key in config.metricKeys"
          :key="key"
          size="small"
          type="info"
        >
          {{ key }}
        </LTag>
      </div>
    </div>

    <div class="relative min-h-[140px] flex-1 p-3">
      <div
        v-if="loading"
        class="absolute inset-0 flex items-center justify-center bg-canvas/40"
      >
        <LSpinner size="sm" />
      </div>
      <div
        v-else-if="!hasData"
        class="flex h-full items-center justify-center text-xs text-fg-tertiary"
      >
        <span v-if="runIds.length === 0">
          Pin or select runs in the sidebar to overlay them here.
        </span>
        <span v-else>
          No data for selected runs.
        </span>
      </div>
      <MetricChart
        v-else
        :metrics="{}"
        :series="series"
        :metric-keys="config.metricKeys"
      />
    </div>

    <div
      v-if="series.length > 0"
      class="flex flex-wrap items-center gap-2 border-t border-border px-3 py-1.5 text-[10px] text-fg-tertiary"
    >
      <span
        v-for="s in series"
        :key="s.runId"
        class="flex items-center gap-1"
      >
        <span
          class="h-2 w-2 rounded-sm"
          :style="{ backgroundColor: s.color }"
          aria-hidden="true"
        />
        <span class="truncate">{{ s.name }}</span>
      </span>
    </div>
  </LCard>
</template>