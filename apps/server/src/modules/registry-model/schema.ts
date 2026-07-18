import { z } from "zod";

export const CreateRegistryModelSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(2048).optional(),
});

export const CreateRegistryModelVersionSchema = z.object({
  version: z.string().min(1).max(64).optional(),
  artifactVersionId: z.string().uuid(),
  aliases: z.array(z.string().min(1).max(64)).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const PatchRegistryModelVersionSchema = z.object({
  aliases: z.array(z.string().min(1).max(64)).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateRegistryModelInput = z.infer<typeof CreateRegistryModelSchema>;
export type CreateRegistryModelVersionInput = z.infer<typeof CreateRegistryModelVersionSchema>;
export type PatchRegistryModelVersionInput = z.infer<typeof PatchRegistryModelVersionSchema>;
