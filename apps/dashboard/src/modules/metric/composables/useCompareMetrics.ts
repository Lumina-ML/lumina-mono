import { useQuery } from "@tanstack/vue-query";
import { computed, type Ref } from "vue";
import { MetricService } from "@/services/metric.service";

export function useCompareMetrics(runIds: Ref<string[]>, keys?: Ref<string[] | undefined>) {
  const enabled = computed(() => runIds.value.length >= 2);

  return useQuery({
    queryKey: ["compareMetrics", runIds, keys],
    queryFn: () =>
      MetricService.compare({
        runIds: runIds.value,
        keys: keys?.value?.join(","),
      }),
    enabled,
  });
}
