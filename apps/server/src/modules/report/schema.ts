import { z } from "zod";

export const ReportBlockSchema = z.record(z.unknown());

export const CreateReportSchema = z.object({
  title: z.string().min(1).max(512),
  blocks: z.array(ReportBlockSchema).default([]),
  createdBy: z.string().optional(),
});

export const PatchReportSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  blocks: z.array(ReportBlockSchema).optional(),
  createdBy: z.string().optional(),
});

export type CreateReportInput = z.infer<typeof CreateReportSchema>;
export type PatchReportInput = z.infer<typeof PatchReportSchema>;

/**
 * Workspace-wide (cross-project) report list. Mirrors the shape used by
 * `/projects/:projectId/reports` but accepts an optional `projectId` filter
 * so the dashboard's top-level Reports view can page through everything.
 */
export const ListReportsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListReportsQuery = z.infer<typeof ListReportsQuerySchema>;
