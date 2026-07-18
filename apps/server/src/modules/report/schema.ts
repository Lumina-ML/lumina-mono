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
