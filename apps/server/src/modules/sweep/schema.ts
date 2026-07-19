import { z } from "zod";

export const SweepMethodSchema = z.enum(["random", "grid", "bayes"]);
export const SweepStateSchema = z.enum([
  "pending",
  "running",
  "finished",
  "crashed",
  "cancelled",
]);

export const ParameterSchema = z.union([
  z.object({ values: z.array(z.any()) }),
  z.object({
    min: z.number(),
    max: z.number(),
    distribution: z.enum(["uniform", "log_uniform", "normal"]).optional(),
  }),
]);

export const EarlyTerminateSchema = z
  .object({
    type: z.enum(["hyperband", "median"]),
    /** Step at which early-termination starts being considered. */
    min_iter: z.number().int().positive().optional(),
    /** Hyperband only: reduction factor (default 3). */
    eta: z.number().positive().optional(),
    /** Hyperband only: max budget per bracket (default 81). */
    max_iter: z.number().int().positive().optional(),
  })
  .optional();

export const SweepConfigSchema = z.object({
  parameters: z.record(ParameterSchema),
  metric: z.object({ name: z.string(), goal: z.enum(["minimize", "maximize"]) }).optional(),
  early_terminate: EarlyTerminateSchema,
});

export const CreateSweepSchema = z.object({
  name: z.string().min(1).max(256),
  method: SweepMethodSchema.default("random"),
  config: SweepConfigSchema,
});

export const UpdateSweepSchema = z.object({
  state: SweepStateSchema.optional(),
  bestRunId: z.string().uuid().optional().nullable(),
  config: SweepConfigSchema.optional(),
});

export const ObservationSchema = z.object({
  runId: z.string().uuid(),
  params: z.record(z.unknown()),
  metric: z.number().nullable(),
  status: z.string(),
  createdAt: z.coerce.date(),
});

export const ListObservationsResponseSchema = z.object({
  items: z.array(ObservationSchema),
});

export const SuggestRequestSchema = z.object({
  count: z.number().int().positive().max(64).default(1),
});

export const SuggestResponseSchema = z.object({
  candidates: z.array(z.record(z.unknown())),
});

export const ShouldTerminateRequestSchema = z.object({
  runId: z.string().uuid(),
  step: z.number().int().nonnegative(),
  metric: z.number(),
});

export const ShouldTerminateResponseSchema = z.object({
  shouldTerminate: z.boolean(),
  reason: z.string().optional(),
});

export type CreateSweepInput = z.infer<typeof CreateSweepSchema>;
export type UpdateSweepInput = z.infer<typeof UpdateSweepSchema>;
export type SweepConfig = z.infer<typeof SweepConfigSchema>;
export type Parameter = z.infer<typeof ParameterSchema>;
export type Observation = z.infer<typeof ObservationSchema>;
export type SuggestRequest = z.infer<typeof SuggestRequestSchema>;
export type ShouldTerminateRequest = z.infer<typeof ShouldTerminateRequestSchema>;

/**
 * Workspace-wide (cross-project) sweep list. Mirrors the shape used by
 * `/projects/:projectId/sweeps` but accepts an optional `projectId` filter
 * so the dashboard's top-level Sweeps view can page through everything.
 */
export const ListSweepsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListSweepsQuery = z.infer<typeof ListSweepsQuerySchema>;
