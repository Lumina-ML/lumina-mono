import { z } from "zod";

export const RunStatusSchema = z.enum(["running", "finished", "failed"]);

export const CreateRunSchema = z.object({
  project: z.string().min(1),
  name: z.string().min(1),
  config: z.record(z.unknown()).default({}),
});

export const UpdateRunSchema = z.object({
  status: RunStatusSchema.optional(),
  config: z.record(z.unknown()).optional(),
});

export const ListRunsQuerySchema = z.object({
  project: z.string().optional(),
  status: RunStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateRunInput = z.infer<typeof CreateRunSchema>;
export type UpdateRunInput = z.infer<typeof UpdateRunSchema>;
export type ListRunsQuery = z.infer<typeof ListRunsQuerySchema>;
