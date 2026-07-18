import { useQuery } from "@tanstack/vue-query";
import { MetricService } from "@/services/metric.service";
import type { Ref } from "vue";

export function useMetrics(runId: Ref<string>) {
  return useQuery({
    queryKey: ["metrics", runId],
    queryFn: () => MetricService.list(runId.value, { limit: 10000 }),
    enabled: () => !!runId.value,
    refetchInterval: (query) => {
      // Auto-refetch every 5s if run is running — we don't know here, so handled in page
      return false;
    },
  });
}
