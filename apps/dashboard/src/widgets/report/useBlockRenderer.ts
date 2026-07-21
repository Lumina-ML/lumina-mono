import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { MetricService } from "@/services/metric.service";
import { RunService } from "@/services/run.service";
import { colorForRunId } from "@/composables/useRunColor";

export interface ChartBlockData {
  runId?: string;
  metricKey?: string;
}

export interface ChartBlockResult {
  points: Array<{ step: number; value: number }>;
  runName: string;
  color: string;
}

/**
 * Loads the metric + run display info for a chart-type report block.
 * Lives in `composables/` so `BlockRenderer.vue` stays a thin switch
 * over `Block.type` → render component.
 */
export function useChartBlockData(
  blockId: Ref<string>,
  data: Ref<ChartBlockData>,
) {
  return useQuery({
    queryKey: computed(() => ["block-chart", blockId.value, data.value?.runId]),
    enabled: computed(() => !!data.value?.runId && !!data.value?.metricKey),
    queryFn: async (): Promise<ChartBlockResult | null> => {
      const runId = data.value?.runId;
      const metricKey = data.value?.metricKey;
      if (!runId || !metricKey) return null;
      const [resp, run] = await Promise.all([
        MetricService.list(runId, { limit: 2000 }),
        RunService.get(runId).catch(() => null),
      ]);
      const pts = resp.metrics[metricKey] ?? [];
      return {
        points: pts,
        runName: run?.name ?? runId.slice(0, 8),
        color: colorForRunId(runId),
      };
    },
  });
}