import { fetchApi } from "./api";
import type {
  Trace,
  Span,
  CreateTraceInput,
  PatchTraceInput,
  PatchSpanInput,
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

  patchTrace(traceId: string, data: PatchTraceInput): Promise<Trace> {
    return fetchApi(`/api/v1/traces/${traceId}`, {
      method: "PATCH",
      body: data,
    });
  },

  listSpans(traceId: string): Promise<Span[]> {
    return fetchApi(`/api/v1/traces/${traceId}/spans`);
  },

  getSpan(spanId: string): Promise<Span> {
    return fetchApi(`/api/v1/spans/${spanId}`);
  },

  patchSpan(spanId: string, data: PatchSpanInput): Promise<Span> {
    return fetchApi(`/api/v1/spans/${spanId}`, {
      method: "PATCH",
      body: data,
    });
  },
};
