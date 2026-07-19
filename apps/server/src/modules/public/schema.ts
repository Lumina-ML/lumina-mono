import { z } from "zod";

/**
 * Public read-only query endpoints for shareable / external consumers.
 *
 * These endpoints require an API key (same as the rest of /api/v1) but
 * are intentionally read-only — they expose a stable, paginated shape
 * that the SDK's `PublicApi` can consume without any internal coupling
 * to the write-side modules. No mutations live here.
 */
export const ListPublicRunsQuerySchema = z.object({
  project: z.string().optional(),
  status: z
    .enum([
      "pending",
      "running",
      "finished",
      "failed",
      "crashed",
      "killed",
      "preempting",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ListPublicProjectsQuerySchema = z.object({
  workspaceId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListPublicRunsQuery = z.infer<typeof ListPublicRunsQuerySchema>;
export type ListPublicProjectsQuery = z.infer<typeof ListPublicProjectsQuerySchema>;