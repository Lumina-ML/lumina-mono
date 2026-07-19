import { useQuery } from "@tanstack/vue-query";
import { EvaluationService } from "@/services/evaluation.service";
import type { ListEvaluationsQuery } from "@/types/evaluation";
import type { Ref } from "vue";

export function useEvaluations(params?: Ref<ListEvaluationsQuery>) {
  return useQuery({
    queryKey: ["evaluations", params?.value],
    queryFn: () => EvaluationService.list(params?.value),
  });
}

export function useEvaluation(evaluationId: Ref<string>) {
  return useQuery({
    queryKey: ["evaluation", evaluationId],
    queryFn: () => EvaluationService.get(evaluationId.value),
    enabled: () => !!evaluationId.value,
  });
}