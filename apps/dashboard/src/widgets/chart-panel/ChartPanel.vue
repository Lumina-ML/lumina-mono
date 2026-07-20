<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { Pencil, X } from "lucide-vue-next";
import {
  LCard,
  LSpinner,
  LTooltip,
  LIconButton,
  LTag,
  ChartRenderer,
  smoothSeries,
  clipOutliers,
  mapXAxis,
  buildAggregatedSeries,
  deriveMetric,
} from "@lumina/ui";
import type { ChartConfig, MetricPoint } from "@lumina/ui";
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
  metrics: Record<string, MetricPoint[]>;
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
      metrics: (metricsByRun[run.runId] ?? {}) as Record<string, MetricPoint[]>,
      color: props.config.colorOverrides?.[run.runId] ?? colorForRunId(run.runId),
    }));
  },
});

const series = computed<PanelSeries[]>(() => panelQuery.data.value ?? []);
const loading = computed(() => panelQuery.isLoading.value);

const dataCfg = computed(() => props.config.data ?? {});
const chartCfg = computed(() => props.config.chart ?? {});

const xAxisMode = computed(() => dataCfg.value.xAxis ?? "step");
const yAxisType = computed<"value" | "log">(() =>
  dataCfg.value.yAxis === "log" ? "log" : "value",
);
const chartType = computed(() => dataCfg.value.chartType ?? "line");
const smoothing = computed(() => dataCfg.value.smoothing ?? 0);
const sampling = computed(() => dataCfg.value.sampling ?? "lttb");
const samplingThreshold = computed(() => dataCfg.value.samplingThreshold ?? 2_000);
const outlierClip = computed(() => dataCfg.value.outlierClip ?? false);

const xAxisTitle = computed(() => {
  if (chartCfg.value.xAxisTitle) return chartCfg.value.xAxisTitle;
  switch (xAxisMode.value) {
    case "wall":
      return "Wall time";
    case "relative":
      return "Relative time";
    case "metric":
      return "Metric value";
    default:
      return "Step";
  }
});

const chartConfig = computed<ChartConfig>(() => {
  const seriesOut: ChartConfig["series"] = [];
  const aggregation = props.config.grouping?.aggregation;
  const shouldAggregate =
    aggregation && aggregation !== "none" && series.value.length >= 3;

  const addSeries = (
    name: string,
    _key: string,
    color: string | undefined,
    pts: MetricPoint[],
    extra: { lineWidth?: number; areaOpacity?: number } = {},
  ) => {
    if (!pts || pts.length === 0) return;
    let data = pts.slice();
    if (smoothing.value > 0) {
      data = smoothSeries(data, smoothing.value, "movingAverage");
    }
    if (outlierClip.value) {
      data = clipOutliers(data);
    }
    // metric 模式需要选择另一 metric 作为 x；当前 UI 未提供选择器，暂时回退到 step。
    const mode = xAxisMode.value;
    const mapped =
      mode === "metric"
        ? mapXAxis(data, "step")
        : mapXAxis(data, mode);
    seriesOut.push({
      type: chartType.value,
      name,
      data: mapped,
      smooth: chartType.value === "line",
      showSymbol: mapped.length < 200,
      color,
      lineWidth: extra.lineWidth ?? 1.5,
      areaOpacity: extra.areaOpacity,
      sampling: sampling.value === "raw" ? undefined : sampling.value,
    });
  };

  for (const key of props.config.metricKeys) {
    if (shouldAggregate) {
      const runSeries = series.value
        .filter((s) => s.metrics[key]?.length)
        .map((s) => ({
          name: s.run.name,
          key,
          runId: s.run.runId,
          color: s.color,
          data: s.metrics[key]!,
        }));
      if (runSeries.length > 0) {
        const agg = buildAggregatedSeries(runSeries, aggregation, {
          color: runSeries[0]?.color,
        });
        for (const s of agg) {
          addSeries(s.name, key, s.color, s.data);
        }
      }
      continue;
    }

    for (const s of series.value) {
      const pts = s.metrics[key];
      if (!pts?.length) continue;
      const color = props.config.colorOverrides?.[s.run.runId] ?? s.color;
      addSeries(`${s.run.name} · ${key}`, key, color, pts);
    }
  }

  // Derived metrics computed per run from the modal expression tab.
  for (const expr of props.config.expressions ?? []) {
    if (!expr.name || !expr.expression) continue;
    for (const s of series.value) {
      const metricsByKey: Record<string, MetricPoint[]> = {};
      for (const key of Object.keys(s.metrics)) {
        metricsByKey[key] = s.metrics[key]!;
      }
      const derived = deriveMetric(metricsByKey, expr.expression, {
        name: `${s.run.name} · ${expr.name}`,
      });
      if (derived.data.length === 0) continue;
      const color = props.config.colorOverrides?.[s.run.runId] ?? s.color;
      addSeries(derived.name, expr.name, color, derived.data);
    }
  }

  return {
    title: undefined,
    xAxis: {
      type: xAxisMode.value === "wall" ? "time" : "value",
      name: xAxisTitle.value,
      splitLine: false,
    },
    yAxis: {
      type: yAxisType.value,
      name: chartCfg.value.yAxisTitle ?? "Value",
      splitLine: { lineStyle: { type: "dashed" } },
    },
    legend: {
      show: chartCfg.value.legendVisible ?? true,
      position: chartCfg.value.legendPosition ?? "bottom",
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
    performance: { samplingThreshold: samplingThreshold.value },
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