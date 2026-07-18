import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(128),
  displayName: z.string().max(256).optional(),
  description: z.string().max(2048).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const UpdateProjectSchema = z.object({
  displayName: z.string().max(256).optional(),
  description: z.string().max(2048).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const ProjectParamsSchema = z.object({ id: z.string().uuid() });

export const ListProjectsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
