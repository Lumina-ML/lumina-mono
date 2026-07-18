import { z } from "zod";

export const ArtifactTypeSchema = z.enum([
  "dataset",
  "model",
  "checkpoint",
  "file",
  "table",
]);

export const ArtifactVersionStateSchema = z.enum([
  "pending",
  "committed",
  "deleted",
]);

export const CreateArtifactSchema = z.object({
  name: z.string().min(1).max(256),
  type: ArtifactTypeSchema.default("file"),
  description: z.string().max(2048).optional(),
});

export const CreateArtifactVersionSchema = z.object({
  version: z.string().min(1).max(64),
  aliases: z.array(z.string().min(1).max(64)).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const PatchArtifactVersionSchema = z.object({
  aliases: z.array(z.string().min(1).max(64)).optional(),
  metadata: z.record(z.unknown()).optional(),
  state: ArtifactVersionStateSchema.optional(),
});

export const CreateArtifactFileSchema = z.object({
  path: z.string().min(1).max(2048),
  size: z.coerce.bigint().default(0n),
  md5: z.string().max(64).optional(),
});

export type CreateArtifactInput = z.infer<typeof CreateArtifactSchema>;
export type CreateArtifactVersionInput = z.infer<typeof CreateArtifactVersionSchema>;
export type PatchArtifactVersionInput = z.infer<typeof PatchArtifactVersionSchema>;
export type CreateArtifactFileInput = z.infer<typeof CreateArtifactFileSchema>;
