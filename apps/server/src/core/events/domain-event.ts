import { z } from "zod";

/**
 * Domain event schemas and inferred types.
 *
 * We use Zod's `discriminatedUnion("type", ...)` instead of plain TS
 * interfaces because:
 *
 *   1. The `MemoryEventBus` and `RedisEventBus` accept and re-emit events
 *      that may have originated as JSON (Redis round-trips strip the
 *      `Date` type → `occurredAt` becomes `string`). Without runtime
 *      validation, subscribers that do date math silently get NaNs.
 *
 *   2. The `type` field was previously a free `string`, so a typo at a
 *      publish site (e.g. `"ArtifactUpload"`) would compile and silently
 *      find zero subscribers. Discriminated unions close that hole at
 *      both compile time and runtime.
 *
 * Both the schema and the inferred TS type are exported. Consumers should
 * prefer the inferred types (`MetricLoggedEvent`, etc.) for parameters.
 */

const baseFields = {
  occurredAt: z.coerce.date(),
};

export const metricLoggedEventSchema = z.object({
  type: z.literal("MetricLogged"),
  ...baseFields,
  payload: z.object({
    runId: z.string(),
    projectId: z.string(),
    workspaceId: z.string(),
    keys: z.array(z.string()),
    count: z.number().int().nonnegative(),
  }),
});

export const runCreatedEventSchema = z.object({
  type: z.literal("RunCreated"),
  ...baseFields,
  payload: z.object({
    runId: z.string(),
    projectId: z.string(),
    workspaceId: z.string(),
  }),
});

export const runFinishedEventSchema = z.object({
  type: z.literal("RunFinished"),
  ...baseFields,
  payload: z.object({
    runId: z.string(),
    projectId: z.string(),
    workspaceId: z.string(),
    status: z.string(),
  }),
});

export const artifactUploadedEventSchema = z.object({
  type: z.literal("ArtifactUploaded"),
  ...baseFields,
  payload: z.object({
    artifactVersionId: z.string(),
    projectId: z.string(),
    workspaceId: z.string(),
    fileCount: z.number().int().nonnegative(),
    /**
     * Content digest of the uploaded artifact. The publish site in
     * `modules/artifact/service.ts` populates this; declared here so
     * subscribers (websocket fanout, queues) can rely on its presence.
     */
    digest: z.string(),
  }),
});

export const domainEventSchema = z.discriminatedUnion("type", [
  metricLoggedEventSchema,
  runCreatedEventSchema,
  runFinishedEventSchema,
  artifactUploadedEventSchema,
]);

export type DomainEvent = z.infer<typeof domainEventSchema>;
export type KnownDomainEvent = DomainEvent;

/**
 * Base shape for any event (including future, non-discriminated ones).
 * Used by the bus implementations when the caller doesn't narrow to
 * a specific event subtype.
 */
export const domainEventBaseSchema = z.object({
  type: z.string(),
  occurredAt: z.coerce.date(),
  payload: z.unknown(),
});
export type DomainEventBase = z.infer<typeof domainEventBaseSchema>;

export type MetricLoggedEvent = z.infer<typeof metricLoggedEventSchema>;
export type RunCreatedEvent = z.infer<typeof runCreatedEventSchema>;
export type RunFinishedEvent = z.infer<typeof runFinishedEventSchema>;
export type ArtifactUploadedEvent = z.infer<typeof artifactUploadedEventSchema>;

/** Map from event `type` literal to its full event type. */
export type DomainEventByType = {
  MetricLogged: MetricLoggedEvent;
  RunCreated: RunCreatedEvent;
  RunFinished: RunFinishedEvent;
  ArtifactUploaded: ArtifactUploadedEvent;
};

export type DomainEventType = keyof DomainEventByType;