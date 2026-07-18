import { useQuery } from "@tanstack/vue-query";
import { TagService } from "@/services/tag.service";
import type { Ref } from "vue";

export function useRunTags(runId: Ref<string>) {
  return useQuery({
    queryKey: ["run-tags", runId],
    queryFn: () => TagService.listByRun(runId.value),
    enabled: () => !!runId.value,
  });
}
