export interface MetricRecord {
  key: string;
  step: number;
  value: number;
  metadata?: Record<string, unknown>;
  loggedAt?: Date;
}

export interface MetricListOptions {
  keys?: string[];
  limit: number;
}

export interface MetricListResult {
  runId: string;
  metrics: Record<string, Array<{ step: number; value: number; loggedAt: string }>>;
}

export interface MetricStorage {
  insertMetrics(runId: string, projectId: string, metrics: MetricRecord[]): Promise<void>;
  listMetrics(runId: string, options: MetricListOptions): Promise<MetricListResult>;
}
