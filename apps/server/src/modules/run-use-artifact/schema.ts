import { z } from "zod";

export const RecordUseArtifactSchema = z.object({
  artifactVersionId: z.string().min(1),
  /// Free-form tag from the SDK ("input" / "output" / "job" / ...).
  type: z.string().min(1).max(64).optional(),
});

export type RecordUseArtifactInput = z.infer<typeof RecordUseArtifactSchema>;