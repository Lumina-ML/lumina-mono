import { z } from "zod";

export const RunStatusSchema = z.enum([
  "pending",
  "running",
  "finished",
  "failed",
  "crashed",
  "killed",
  "preempting",
]);

export const CreateRunSchema = z.object({
  project: z.string().min(1).max(128),
  // Name is optional so SDK calls like `lumina.init(project="foo")` (no
  // explicit name) succeed. The repository assigns a generated slug when
  // the field is missing or empty.
  name: z.string().min(1).max(256).optional(),
  sweepId: z.string().uuid().optional(),
  config: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
});

export const UpdateRunSchema = z.object({
  status: RunStatusSchema.optional(),
  config: z.record(z.unknown()).optional(),
  summary: z.record(z.unknown()).optional(),
  // `null` is accepted so the dashboard can clear existing notes via PATCH.
  // The repository treats `undefined` as "leave unchanged" and any other
  // value (including `null` / `""`) as an explicit write.
  notes: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  /// SDK telemetry envelope (CLI/library versions, GPU/CPU flags). Step 3.2
  /// folds wandb's TelemetryRecord into the existing PATCH /runs/:id.
  telemetry: z.record(z.unknown()).optional(),
  /// Metric definitions keyed by name. Step 3.2 replaces the wandb
  /// MetricRecord push (which used to be embedded in the next config push).
  metricDefs: z.record(z.unknown()).optional(),
});

export const ListRunsQuerySchema = z.object({
  project: z.string().optional(),
  status: RunStatusSchema.optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateRunInput = z.infer<typeof CreateRunSchema>;
export type UpdateRunInput = z.infer<typeof UpdateRunSchema>;
export type ListRunsQuery = z.infer<typeof ListRunsQuerySchema>;
