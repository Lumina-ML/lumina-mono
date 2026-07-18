import { z } from "zod";

export const MediaTypeSchema = z.enum([
  "table",
  "image",
  "video",
  "audio",
  "plotly",
  "html",
  "file",
]);

export const CreateRunMediaSchema = z.object({
  runId: z.string().uuid().optional(),
  key: z.string().min(1).max(256),
  type: MediaTypeSchema,
  artifactVersionId: z.string().uuid(),
  metadata: z.record(z.unknown()).default({}),
});

export const ListRunMediaQuerySchema = z.object({
  runId: z.string().optional(),
  type: MediaTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateRunMediaInput = z.infer<typeof CreateRunMediaSchema>;
export type ListRunMediaQuery = z.infer<typeof ListRunMediaQuerySchema>;
