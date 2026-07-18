import { fetchApi } from "./api";
import type { MetricsResponse, ListMetricsQuery, LogMetricsInput } from "@/types/metric";

export const SystemMetricService = {
  list(runId: string, params?: ListMetricsQuery): Promise<MetricsResponse> {
    return fetchApi(`/api/v1/runs/${runId}/system-metrics`, { params });
  },

  log(runId: string, data: LogMetricsInput): Promise<{ success: boolean }> {
    return fetchApi(`/api/v1/runs/${runId}/system-metrics`, { method: "POST", body: data });
  },
};
