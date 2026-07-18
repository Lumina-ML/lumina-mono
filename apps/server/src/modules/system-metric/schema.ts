import { z } from "zod";

export const SystemMetricPointSchema = z.object({
  key: z.string().min(1),
  step: z.number().int().min(0).default(0),
  value: z.number(),
});

export const LogSystemMetricsSchema = z.object({
  metrics: z.array(SystemMetricPointSchema).min(1).max(1000),
});

export const ListSystemMetricsQuerySchema = z.object({
  keys: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50000).default(10000),
});

export type LogSystemMetricsInput = z.infer<typeof LogSystemMetricsSchema>;
export type ListSystemMetricsQuery = z.infer<typeof ListSystemMetricsQuerySchema>;
