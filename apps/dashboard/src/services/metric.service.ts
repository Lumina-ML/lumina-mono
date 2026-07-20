import { fetchApi } from "./api";
import type {
  MetricsResponse,
  ListMetricsQuery,
  LogMetricsInput,
  CompareMetricsInput,
  CompareMetricsResponse,
} from "@/types/metric";

export const MetricService = {
  list(runId: string, params?: ListMetricsQuery): Promise<MetricsResponse> {
    return fetchApi(`/api/v1/runs/${runId}/metrics`, { params });
  },

  log(runId: string, data: LogMetricsInput): Promise<{ success: boolean }> {
    return fetchApi(`/api/v1/runs/${runId}/metrics`, { method: "POST", body: data });
  },

  compare(data: CompareMetricsInput): Promise<CompareMetricsResponse> {
    return fetchApi("/api/v1/runs/metrics", { method: "POST", body: data });
  },
};
