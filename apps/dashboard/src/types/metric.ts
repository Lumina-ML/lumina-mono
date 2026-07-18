export interface MetricPoint {
  step: number;
  value: number;
  loggedAt: string;
}

export interface MetricsResponse {
  runId: string;
  metrics: Record<string, MetricPoint[]>;
}

export interface LogMetricsInput {
  metrics: Array<{
    key: string;
    step?: number;
    value: number;
  }>;
}

export interface ListMetricsQuery {
  keys?: string;
  limit?: number;
}
