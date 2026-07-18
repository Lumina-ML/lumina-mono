import { useQuery } from "@tanstack/vue-query";
import { MetricService } from "@/services/metric.service";
import type { Ref } from "vue";

export function useMetrics(runId: Ref<string>) {
  return useQuery({
    queryKey: ["metrics", runId],
    queryFn: () => MetricService.list(runId.value, { limit: 10000 }),
    enabled: () => !!runId.value,
    refetchInterval: () => {
      // Auto-refetch every 5s if run is running — handled in page via useAutoRefresh
      return false;
    },
  });
}
