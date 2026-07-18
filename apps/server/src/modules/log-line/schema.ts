import { z } from "zod";

export const LogLevelSchema = z.enum([
  "DEBUG",
  "INFO",
  "WARNING",
  "ERROR",
  "CRITICAL",
]);

export const LogLineSchema = z.object({
  level: LogLevelSchema.default("INFO"),
  message: z.string().min(1).max(8192),
  step: z.number().int().min(0).optional(),
  timestamp: z.coerce.date().optional(),
});

export const LogLinesSchema = z.object({
  logs: z.array(LogLineSchema).min(1).max(1000),
});

export const ListLogLinesQuerySchema = z.object({
  level: LogLevelSchema.optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(1000),
});

export type LogLineInput = z.infer<typeof LogLineSchema>;
export type LogLinesInput = z.infer<typeof LogLinesSchema>;
export type ListLogLinesQuery = z.infer<typeof ListLogLinesQuerySchema>;
