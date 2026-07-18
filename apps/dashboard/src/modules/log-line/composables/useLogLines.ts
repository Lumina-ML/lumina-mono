import { useQuery } from "@tanstack/vue-query";
import { LogLineService } from "@/services/log-line.service";
import type { ListLogLinesQuery } from "@/types/log-line";
import type { Ref } from "vue";

export function useLogLines(runId: Ref<string>, params?: Ref<ListLogLinesQuery>) {
  return useQuery({
    queryKey: ["log-lines", runId, params?.value],
    queryFn: () => LogLineService.list(runId.value, params?.value),
    enabled: () => !!runId.value,
  });
}
