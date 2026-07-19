import { z } from "zod";

export const SaveFileBodySchema = z.object({
  path: z.string().min(1).max(1024),
  contentBase64: z.string().min(1),
  policy: z.enum(["live", "now"]).default("live"),
});

export const ListFilesQuerySchema = z.object({
  prefix: z.string().optional(),
});

export const GetFileQuerySchema = z.object({
  path: z.string().min(1),
});

export type SaveFileBody = z.infer<typeof SaveFileBodySchema>;