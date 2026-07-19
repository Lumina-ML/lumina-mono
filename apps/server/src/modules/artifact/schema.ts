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

export const LineageTypeSchema = z
  .enum(["derived_from", "used", "produced", "forked"])
  .default("derived_from");

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

/**
 * CreateArtifactFileSchema accepts either a content upload (`sha256` provided
 * for dedup) or a reference artifact (`referenceUri` pointing at an external
 * location, no upload required).
 */
export const CreateArtifactFileSchema = z
  .object({
    path: z.string().min(1).max(2048),
    size: z.coerce.bigint().default(0n),
    md5: z.string().max(64).optional(),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "sha256 must be lowercase hex")
      .optional(),
    contentType: z.string().max(256).optional(),
    referenceUri: z.string().min(1).max(2048).optional(),
  })
  .refine((d) => d.referenceUri || d.size !== undefined, {
    message: "Either referenceUri or size must be provided",
  });

export const AttachLineageSchema = z.object({
  parentVersionId: z.string().uuid(),
  type: LineageTypeSchema,
});

export const ManifestEntrySchema = z.object({
  path: z.string(),
  digest: z.string(),
  size: z.string(),
  referenceUri: z.string().optional(),
  contentType: z.string().optional(),
});

export const ManifestSchema = z.object({
  version: z.literal(1),
  entries: z.array(ManifestEntrySchema),
});

export type CreateArtifactInput = z.infer<typeof CreateArtifactSchema>;
export type CreateArtifactVersionInput = z.infer<typeof CreateArtifactVersionSchema>;
export type PatchArtifactVersionInput = z.infer<typeof PatchArtifactVersionSchema>;
export type CreateArtifactFileInput = z.infer<typeof CreateArtifactFileSchema>;
export type AttachLineageInput = z.infer<typeof AttachLineageSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

/**
 * Workspace-wide (cross-project) artifact list. Mirrors the shape used by
 * `/projects/:projectId/artifacts` but accepts an optional `projectId` /
 * `type` filter so the dashboard's top-level Artifacts/Datasets views can
 * page through everything in one request.
 */
export const ListArtifactsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  type: ArtifactTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListArtifactsQuery = z.infer<typeof ListArtifactsQuerySchema>;