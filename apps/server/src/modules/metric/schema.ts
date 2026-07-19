import { z } from "zod";

export const MetricPointSchema = z.object({
  key: z.string().min(1),
  step: z.number().int().min(0).default(0),
  value: z.number(),
});

export const LogMetricsSchema = z.object({
  metrics: z.array(MetricPointSchema).min(1).max(1000),
});

export const ListMetricsQuerySchema = z.object({
  // Accept both `?keys=a,b,c` (comma-separated) and `?keys=a&keys=b&keys=c`
  // (repeated). Fastify parses the repeated form into a string array; the
  // metric handler joins arrays into a single string before delegating.
  // Closes the SDK-Server-FE Gap doc item #14 — the SDK's `_compute_summary_aggregations`
  // hits this endpoint and needs both forms to work.
  keys: z.union([z.string(), z.array(z.string())]).optional(),
  limit: z.coerce.number().int().min(1).max(50000).default(10000),
});

export type LogMetricsInput = z.infer<typeof LogMetricsSchema>;
export type ListMetricsQuery = z.infer<typeof ListMetricsQuerySchema>;
