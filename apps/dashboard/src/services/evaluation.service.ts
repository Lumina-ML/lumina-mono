import { fetchApi } from "./api";
import type {
  Evaluation,
  EvaluationResult,
  CreateEvaluationInput,
  ListEvaluationsQuery,
} from "@/types/evaluation";
import type { PaginatedResponse } from "@/types/project";

export const EvaluationService = {
  list(params?: ListEvaluationsQuery): Promise<PaginatedResponse<Evaluation>> {
    const { projectId, ...rest } = params ?? {};
    const path = projectId
      ? `/api/v1/projects/${projectId}/evaluations`
      : `/api/v1/evaluations`;
    return fetchApi(path, { params: rest });
  },

  get(evaluationId: string): Promise<Evaluation> {
    return fetchApi(`/api/v1/evaluations/${evaluationId}`);
  },

  create(projectId: string, data: CreateEvaluationInput): Promise<Evaluation> {
    return fetchApi(`/api/v1/projects/${projectId}/evaluations`, {
      method: "POST",
      body: data,
    });
  },

  addResult(evaluationId: string, key: string, value: number) {
    return fetchApi(`/api/v1/evaluations/${evaluationId}/results`, {
      method: "POST",
      body: { key, value },
    });
  },

  listResults(evaluationId: string): Promise<EvaluationResult[]> {
    return fetchApi(`/api/v1/evaluations/${evaluationId}/results`);
  },
};