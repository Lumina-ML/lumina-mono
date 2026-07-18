import { z } from "zod";

export const LaunchRunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const CreateLaunchQueueSchema = z.object({
  name: z.string().min(1).max(128),
  config: z.record(z.unknown()).default({}),
});

export const CreateLaunchJobSchema = z.object({
  name: z.string().min(1).max(128),
  image: z.string().max(512).optional(),
  command: z.array(z.string()).default([]),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  config: z.record(z.unknown()).default({}),
});

export const CreateLaunchRunSchema = z.object({
  queueId: z.string().uuid(),
  jobId: z.string().uuid(),
  runId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const PatchLaunchRunSchema = z.object({
  status: LaunchRunStatusSchema.optional(),
  runId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateLaunchQueueInput = z.infer<typeof CreateLaunchQueueSchema>;
export type CreateLaunchJobInput = z.infer<typeof CreateLaunchJobSchema>;
export type CreateLaunchRunInput = z.infer<typeof CreateLaunchRunSchema>;
export type PatchLaunchRunInput = z.infer<typeof PatchLaunchRunSchema>;
