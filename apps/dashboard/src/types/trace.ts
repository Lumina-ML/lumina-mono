export interface Trace {
  id: string;
  projectId: string;
  name: string;
  startTime: string;
  endTime: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  _count?: {
    spans: number;
  };
}

export interface Span {
  id: string;
  traceId: string;
  parentSpanId: string | null;
  name: string;
  startTime: string;
  endTime: string | null;
  attributes: Record<string, unknown>;
}

export interface CreateTraceInput {
  name: string;
  startTime?: string;
  endTime?: string;
  metadata?: Record<string, unknown>;
}

export interface ListTracesQuery {
  projectId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}