export interface MetricPoint {
  step: number;
  value: number;
  loggedAt: string;
}

export interface MetricsResponse {
  runId: string;
  metrics: Record<string, MetricPoint[]>;
}

export interface CompareMetricsInput {
  runIds: string[];
  keys?: string;
  limit?: number;
}

export interface CompareMetricsResponse {
  runs: MetricsResponse[];
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
