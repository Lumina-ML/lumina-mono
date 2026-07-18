import { useQuery } from "@tanstack/vue-query";
import { SystemMetricService } from "@/services/system-metric.service";
import type { Ref } from "vue";

export function useSystemMetrics(runId: Ref<string>) {
  return useQuery({
    queryKey: ["system-metrics", runId],
    queryFn: () => SystemMetricService.list(runId.value, { limit: 10000 }),
    enabled: () => !!runId.value,
  });
}
