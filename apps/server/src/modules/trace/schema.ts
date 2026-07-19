import { z } from "zod";

export const TraceStatusSchema = z.enum(["ok", "error"]);

export const SpanKindSchema = z.enum([
  "llm",
  "tool",
  "retriever",
  "chain",
  "agent",
  "internal",
]);

export const SpanStatusSchema = z.enum(["ok", "error"]);

export const CreateTraceSchema = z.object({
  traceId: z.string().min(1).max(256).optional(),
  name: z.string().min(1).max(256),
  runId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const PatchTraceSchema = z.object({
  status: TraceStatusSchema.optional(),
  latencyMs: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
  finishedAt: z.coerce.date().optional(),
});

export const CreateSpanSchema = z.object({
  spanId: z.string().min(1).max(256).optional(),
  parentSpanId: z.string().min(1).max(256).optional(),
  name: z.string().min(1).max(256),
  kind: SpanKindSchema.default("internal"),
  input: z.record(z.unknown()).default({}),
  output: z.record(z.unknown()).default({}),
  latencyMs: z.number().int().optional(),
  status: SpanStatusSchema.default("ok"),
});

export const PatchSpanSchema = z.object({
  output: z.record(z.unknown()).optional(),
  latencyMs: z.number().int().optional(),
  status: SpanStatusSchema.optional(),
  finishedAt: z.coerce.date().optional(),
});

export type CreateTraceInput = z.infer<typeof CreateTraceSchema>;
export type PatchTraceInput = z.infer<typeof PatchTraceSchema>;
export type CreateSpanInput = z.infer<typeof CreateSpanSchema>;
export type PatchSpanInput = z.infer<typeof PatchSpanSchema>;

/**
 * Workspace-wide (cross-project) trace list. Mirrors the shape used by
 * `/projects/:projectId/traces` but accepts an optional `projectId` filter
 * so the dashboard's top-level Traces view can page through everything.
 */
export const ListTracesQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListTracesQuery = z.infer<typeof ListTracesQuerySchema>;
