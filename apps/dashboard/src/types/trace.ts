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

export type SpanKind =
  | "llm"
  | "tool"
  | "retriever"
  | "chain"
  | "agent"
  | "internal";

export type SpanStatus = "ok" | "error";

export interface CreateTraceInput {
  name: string;
  runId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSpanInput {
  name: string;
  kind?: SpanKind;
  parentSpanId?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status?: SpanStatus;
  latencyMs?: number;
}

export interface PatchTraceInput {
  status?: "ok" | "error";
  latencyMs?: number;
  metadata?: Record<string, unknown>;
  finishedAt?: string;
}

export interface PatchSpanInput {
  status?: SpanStatus;
  output?: Record<string, unknown>;
  latencyMs?: number;
  finishedAt?: string;
}

export interface ListTracesQuery {
  projectId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}