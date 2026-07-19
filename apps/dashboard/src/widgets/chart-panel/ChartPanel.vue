<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { Pencil, X } from "lucide-vue-next";
import { LCard, LSpinner, LTooltip, LIconButton, LTag, ChartRenderer } from "@lumina/ui";
import type { ChartConfig } from "@lumina/ui";
import { MetricService } from "@/services/metric.service";
import { RunService } from "@/services/run.service";
import { colorForRunId } from "@/composables/useRunColor";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Run } from "@/types/run";
import ChartConfigModal from "@/widgets/chart-panel/ChartConfigModal.vue";

export interface ChartPanelConfig {
  title: string;
  metricKeys: string[];
  smoothing?: number;
  /** Optional opaque overrides from the config modal (axis, sampling, etc.). */
  data?: {
    xAxis?: "step" | "wall" | "relative" | "metric";
    yAxis?: "linear" | "log";
    chartType?: "line" | "bar" | "scatter";
    smoothing?: number;
    sampling?: "raw" | "lttb" | "average";
    samplingThreshold?: number;
    outlierClip?: boolean;
  };
  chart?: {
    title?: string;
    xAxisTitle?: string;
    yAxisTitle?: string;
    legendVisible?: boolean;
    legendPosition?: "top" | "bottom" | "left" | "right";
  };
  grouping?: {
    groupBy?: string | null;
    aggregation?: "min" | "max" | "mean" | "none";
  };
  expressions?: Array<{ name: string; expression: string }>;
  colorOverrides?: Record<string, string>;
}

const props = defineProps<{
  config: ChartPanelConfig;
  runIds: string[];
}>();

const emit = defineEmits<{
  remove: [];
  /** Emitted when the modal saves a new config (caller persists). */
  "update:config": [config: ChartPanelConfig];
}>();

const { formatDate } = useDateFormat();

const configOpen = ref(false);

interface PanelSeries {
  run: Run;
  metrics: Record<string, Array<{ step: number; value: number }>>;
  color: string;
}

const enabled = computed(() => props.runIds.length > 0);

// Fetch runs + metrics in one go so the panel can show overlay even when
// multiple panels reference the same runs (TanStack dedupes by queryKey).
const panelQuery = useQuery({
  queryKey: computed(() => [
    "chart-panel-data",
    props.runIds.slice().sort().join(","),
    props.config.metricKeys.slice().sort().join(","),
  ]),
  enabled,
  queryFn: async (): Promise<PanelSeries[]> => {
    const runs = await Promise.all(
      props.runIds.map((id) =>
        RunService.get(id)
          .then((r) => r as Run | null)
          .catch(() => null),
      ),
    );
    const validRuns = runs.filter((r): r is Run => !!r);
    if (validRuns.length === 0) return [];
    const metricsEntries = await Promise.all(
      validRuns.map(async (run) => {
        try {
          const resp = await MetricService.list(run.runId, { limit: 5000 });
          return [run.runId, resp.metrics] as const;
        } catch {
          return [run.runId, {}] as const;
        }
      }),
    );
    const metricsByRun = Object.fromEntries(metricsEntries);
    return validRuns.map((run) => ({
      run,
      metrics: metricsByRun[run.runId] ?? {},
      color: colorForRunId(run.runId),
    }));
  },
});

const series = computed<PanelSeries[]>(() => panelQuery.data.value ?? []);
const loading = computed(() => panelQuery.isLoading.value);

const chartConfig = computed<ChartConfig>(() => {
  const seriesOut: ChartConfig["series"] = [];
  for (const s of series.value) {
    for (const key of props.config.metricKeys) {
      const pts = s.metrics[key];
      if (!pts || pts.length === 0) continue;
      seriesOut.push({
        type: "line",
        name: `${s.run.name} · ${key}`,
        data: pts.map((p) => [p.step, p.value] as [number, number]),
        smooth: true,
        showSymbol: pts.length < 200,
        color: s.color,
        lineWidth: 1.5,
      });
    }
  }
  return {
    title: undefined,
    xAxis: {
      type: "value",
      name: "Step",
      splitLine: false,
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { type: "dashed" } },
    },
    legend: {
      position: "bottom",
      type: "scroll",
    },
    tooltip: {
      trigger: "axis",
      crosshair: { type: "cross" },
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      { type: "slider", xAxisIndex: 0 },
    ],
    series: seriesOut,
    performance: { samplingThreshold: 2_000 },
  };
});

const summary = computed(() => {
  if (series.value.length === 0) return "";
  const oldest = series.value.reduce(
    (a, s) =>
      new Date(s.run.createdAt) < new Date(a.run.createdAt) ? s : a,
    series.value[0]!,
  );
  return `${series.value.length} runs · since ${formatDate(oldest.run.createdAt)}`;
});
</script>

<template>
  <LCard class="flex h-full flex-col p-0">
    <div class="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <h3 class="truncate text-sm font-medium">{{ config.title }}</h3>
          <LTooltip content="Configure panel">
            <LIconButton aria-label="Configure" @click="configOpen = true">
              <Pencil class="h-3 w-3" />
            </LIconButton>
          </LTooltip>
          <LTooltip content="Remove panel">
            <LIconButton aria-label="Remove" @click="emit('remove')">
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

    <div class="relative min-h-[160px] flex-1 p-2">
      <div
        v-if="loading"
        class="absolute inset-0 z-10 flex items-center justify-center bg-canvas/40"
      >
        <LSpinner size="sm" />
      </div>
      <div
        v-else-if="runIds.length === 0"
        class="flex h-full min-h-[160px] items-center justify-center text-xs text-fg-tertiary"
      >
        Pin or select runs in the sidebar to overlay them here.
      </div>
      <div
        v-else-if="series.length === 0"
        class="flex h-full min-h-[160px] items-center justify-center text-xs text-fg-tertiary"
      >
        No data for the selected runs.
      </div>
      <ChartRenderer v-else :config="chartConfig" height="100%" />
    </div>

    <ChartConfigModal
      v-model:open="configOpen"
      :config="config"
      :run-ids="series.map((s) => s.run.runId)"
      :run-names="Object.fromEntries(series.map((s) => [s.run.runId, s.run.name]))"
      @save="(next) => emit('update:config', next)"
    />
  </LCard>
</template>