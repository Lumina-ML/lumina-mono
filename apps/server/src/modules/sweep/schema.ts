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

export const SweepConfigSchema = z.object({
  parameters: z.record(ParameterSchema),
  metric: z.object({ name: z.string(), goal: z.enum(["minimize", "maximize"]) }).optional(),
  early_terminate: z
    .object({
      type: z.enum(["hyperband"]),
      min_iter: z.number().int().optional(),
    })
    .optional(),
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

export type CreateSweepInput = z.infer<typeof CreateSweepSchema>;
export type UpdateSweepInput = z.infer<typeof UpdateSweepSchema>;
export type SweepConfig = z.infer<typeof SweepConfigSchema>;
