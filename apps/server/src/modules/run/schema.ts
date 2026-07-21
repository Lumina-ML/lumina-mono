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
  /// Optional human-readable alias shown in the dashboard. Independent of
  /// the immutable `runId` (UUID v7). Step 3.2 sends this from the SDK
  /// sender so the rewired init flow keeps wandb's displayName parity.
  displayName: z.string().min(1).max(256).optional(),
  sweepId: z.string().uuid().optional(),
  config: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
  /// Optional workspace entity (org/team). Stored verbatim; workspace
  /// membership is checked separately by `workspaceGuardPlugin`.
  entity: z.string().min(1).max(128).optional(),
  /// Optional run tags applied at creation time. The tag rows are
  /// upserted in `RunRepository.create` so the caller can keep the
  /// simple `tags: [...]` payload shape instead of pre-resolving tag IDs.
  tags: z.array(z.string().min(1).max(64)).max(64).optional(),
  /// Optional grouping hint (used by sweeps/launch to fan out jobs).
  group: z.string().min(1).max(128).optional(),
  /// Optional job type ("train" / "eval" / "sweep-agent" / ...).
  jobType: z.string().min(1).max(128).optional(),
  /// Optional free-form notes. Mirrors wandb's `notes` field.
  notes: z.string().max(8192).optional(),
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
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateRunInput = z.infer<typeof CreateRunSchema>;
export type UpdateRunInput = z.infer<typeof UpdateRunSchema>;
export type ListRunsQuery = z.infer<typeof ListRunsQuerySchema>;
