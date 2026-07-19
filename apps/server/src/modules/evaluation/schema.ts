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

/**
 * Workspace-wide (cross-project) evaluation list. Mirrors the shape used by
 * `/projects/:projectId/evaluations` but accepts an optional `projectId` filter
 * so the dashboard's top-level Evaluations view can page through everything.
 *
 * The heavy nested `include` (`results` + `datasetArtifactVersion` +
 * `modelArtifactVersion`) used by `GET /projects/:projectId/evaluations`
 * is intentionally NOT included on this endpoint — fetching it for every
 * row in a workspace-wide list scales poorly. Detail routes still return
 * the full nested shape.
 */
export const ListEvaluationsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListEvaluationsQuery = z.infer<typeof ListEvaluationsQuerySchema>;
