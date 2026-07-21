import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import type { MetricPoint } from "@lumina/ui";
import { MetricService } from "@/services/metric.service";
import { RunService } from "@/services/run.service";
import { colorForRunId } from "@/composables/useRunColor";
import type { Run } from "@/types/run";

export interface ChartPanelConfig {
  runIds: string[];
  metricKeys: string[];
  colorOverrides?: Record<string, string>;
}

export interface PanelSeries {
  run: Run;
  metrics: Record<string, MetricPoint[]>;
  color: string;
}

/**
 * Data loader for a chart panel: fetches the runs referenced by
 * `config.runIds` and their metric series, returning a per-run panel
 * series ready to be rendered by `ChartRenderer`. Lives in
 * `composables/` so the `ChartPanel.vue` widget stays presentational.
 */
export function useChartPanelData(config: Ref<ChartPanelConfig>) {
  const enabled = computed(() => config.value.runIds.length > 0);

  const query = useQuery({
    queryKey: computed(() => [
      "chart-panel-data",
      config.value.runIds.slice().sort().join(","),
      config.value.metricKeys.slice().sort().join(","),
    ]),
    enabled,
    queryFn: async (): Promise<PanelSeries[]> => {
      const runs = await Promise.all(
        config.value.runIds.map((id) =>
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
        color: config.value.colorOverrides?.[run.runId] ?? colorForRunId(run.runId),
      }));
    },
  });

  const series = computed<PanelSeries[]>(() => query.data.value ?? []);
  const loading = computed(() => query.isLoading.value);

  return { series, loading, query };
}