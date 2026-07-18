import { z } from "zod";

export const EvaluationStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
]);

export const CreateEvaluationSchema = z.object({
  name: z.string().min(1).max(256),
  runId: z.string().uuid().optional(),
  datasetArtifactVersionId: z.string().uuid().optional(),
  modelArtifactVersionId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const CreateEvaluationResultSchema = z.object({
  key: z.string().min(1).max(256),
  value: z.number(),
  metadata: z.record(z.unknown()).default({}),
});

export const PatchEvaluationSchema = z.object({
  status: EvaluationStatusSchema.optional(),
  summary: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateEvaluationInput = z.infer<typeof CreateEvaluationSchema>;
export type CreateEvaluationResultInput = z.infer<typeof CreateEvaluationResultSchema>;
export type PatchEvaluationInput = z.infer<typeof PatchEvaluationSchema>;
