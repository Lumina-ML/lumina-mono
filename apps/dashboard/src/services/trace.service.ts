import { fetchApi } from "./api";
import type {
  Trace,
  Span,
  CreateTraceInput,
  ListTracesQuery,
} from "@/types/trace";
import type { PaginatedResponse } from "@/types/project";

export const TraceService = {
  list(params?: ListTracesQuery): Promise<PaginatedResponse<Trace>> {
    const { projectId, ...rest } = params ?? {};
    const path = projectId
      ? `/api/v1/projects/${projectId}/traces`
      : `/api/v1/traces`;
    return fetchApi(path, { params: rest });
  },

  get(traceId: string): Promise<Trace> {
    return fetchApi(`/api/v1/traces/${traceId}`);
  },

  create(projectId: string, data: CreateTraceInput): Promise<Trace> {
    return fetchApi(`/api/v1/projects/${projectId}/traces`, {
      method: "POST",
      body: data,
    });
  },

  listSpans(traceId: string): Promise<Span[]> {
    return fetchApi(`/api/v1/traces/${traceId}/spans`);
  },
};