import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(128),
  displayName: z.string().max(256).optional(),
  description: z.string().max(2048).optional(),
  settings: z.record(z.unknown()).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
