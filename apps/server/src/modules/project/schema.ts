import { z } from "zod";

/**
 * Project name validator. Names prefixed with `__` are reserved for
 * server-side seeds (currently `__demo__` — see
 * `apps/server/src/core/seed/demo-seed.ts`) and cannot be created by
 * SDK or dashboard callers. This prevents users from impersonating the
 * demo project to scrape its id from URL hints.
 */
const projectNameSchema = z
  .string()
  .min(1)
  .max(128)
  .refine((n) => !n.startsWith("__"), {
    message: "Project names starting with '__' are reserved.",
  });

export const CreateProjectSchema = z.object({
  name: projectNameSchema,
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
