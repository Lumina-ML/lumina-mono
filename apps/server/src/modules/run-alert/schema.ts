import { z } from "zod";

export const CreateRunAlertSchema = z.object({
  title: z.string().min(1).max(256),
  text: z.string().min(1),
  /// "INFO" | "WARN" | "ERROR". Defaults to "INFO" server-side.
  level: z.enum(["INFO", "WARN", "ERROR"]).optional(),
  /// Client-side rate-limit hint (seconds). Server doesn't enforce yet.
  waitDuration: z.number().nonnegative().optional(),
});

export type CreateRunAlertInput = z.infer<typeof CreateRunAlertSchema>;