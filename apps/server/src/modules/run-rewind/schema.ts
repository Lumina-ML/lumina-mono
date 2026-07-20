import { z } from "zod";

export const RewindRunSchema = z.object({
  metricName: z.string().min(1).max(256),
  metricValue: z.number(),
  programPath: z.string().min(1).max(1024).optional(),
});

export type RewindRunInput = z.infer<typeof RewindRunSchema>;