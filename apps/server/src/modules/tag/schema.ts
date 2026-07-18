import { z } from "zod";

export const CreateTagSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().max(32).optional(),
});

export const AttachTagSchema = z.object({
  tagId: z.string().uuid(),
});

export const AttachTagByNameSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().max(32).optional(),
});

export type CreateTagInput = z.infer<typeof CreateTagSchema>;
export type AttachTagInput = z.infer<typeof AttachTagSchema>;
export type AttachTagByNameInput = z.infer<typeof AttachTagByNameSchema>;
