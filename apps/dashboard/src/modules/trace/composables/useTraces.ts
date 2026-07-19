import { useQuery } from "@tanstack/vue-query";
import { TraceService } from "@/services/trace.service";
import type { ListTracesQuery } from "@/types/trace";
import type { Ref } from "vue";

export function useTraces(params?: Ref<ListTracesQuery>) {
  return useQuery({
    queryKey: ["traces", params?.value],
    queryFn: () => TraceService.list(params?.value),
  });
}

export function useTrace(traceId: Ref<string>) {
  return useQuery({
    queryKey: ["trace", traceId],
    queryFn: () => TraceService.get(traceId.value),
    enabled: () => !!traceId.value,
  });
}