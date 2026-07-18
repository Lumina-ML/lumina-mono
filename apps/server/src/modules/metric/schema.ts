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
  keys: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50000).default(10000),
});

export type LogMetricsInput = z.infer<typeof LogMetricsSchema>;
export type ListMetricsQuery = z.infer<typeof ListMetricsQuerySchema>;
