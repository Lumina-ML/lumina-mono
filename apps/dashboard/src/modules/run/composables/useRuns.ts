import { useQuery } from "@tanstack/vue-query";
import { RunService } from "@/services/run.service";
import type { ListRunsQuery } from "@/types/run";
import type { Ref } from "vue";

export function useRuns(params?: Ref<ListRunsQuery>) {
  return useQuery({
    queryKey: ["runs", params?.value],
    queryFn: () => RunService.list(params?.value),
  });
}

export function useRun(runId: Ref<string>) {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => RunService.get(runId.value),
    enabled: () => !!runId.value,
  });
}
