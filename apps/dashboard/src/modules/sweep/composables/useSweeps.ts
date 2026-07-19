import { useQuery } from "@tanstack/vue-query";
import { SweepService } from "@/services/sweep.service";
import type { ListSweepsQuery } from "@/types/sweep";
import type { Ref } from "vue";

export function useSweeps(params?: Ref<ListSweepsQuery>) {
  return useQuery({
    queryKey: ["sweeps", params?.value],
    queryFn: () => SweepService.list(params?.value),
  });
}

export function useSweep(sweepId: Ref<string>) {
  return useQuery({
    queryKey: ["sweep", sweepId],
    queryFn: () => SweepService.get(sweepId.value),
    enabled: () => !!sweepId.value,
  });
}