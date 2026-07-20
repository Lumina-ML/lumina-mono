import { useQuery } from "@tanstack/vue-query";
import { computed, type Ref } from "vue";
import { RunService } from "@/services/run.service";

export function useRunsByIds(runIds: Ref<string[]>) {
  const enabled = computed(() => runIds.value.length > 0);

  return useQuery({
    queryKey: ["runsByIds", runIds],
    queryFn: () => Promise.all(runIds.value.map((id) => RunService.get(id))),
    enabled,
  });
}
