import { z } from "zod";
import type { FastifyBaseLogger } from "fastify";
import type { KnownDomainEvent } from "../core/events/domain-event.js";
import type { PrismaClient } from "../generated/prisma/index.js";
import type { MetricStorage } from "../core/storage/metric-storage.js";
import type { TimeSeriesStorage } from "../core/storage/time-series-storage.js";
import type { Cache } from "../core/cache/cache.js";

/**
 * Job payload schemas and inferred types.
 *
 * Mirrors `domain-event.ts` philosophy: a Zod discriminated union keeps
 * both the `name` discriminator and the per-job payload shape type-safe at
 * compile time *and* runtime. Without this, BullMQ serializes jobs
 * through JSON and a typo in `name` (or a malformed payload) silently
 * reaches the wrong processor (or is `unknown`-cast inside it).
 *
 * `JobProcessor.process` is narrowed to accept the inferred payload
 * directly (instead of `{ name; payload: unknown }`) so each processor
 * implementation gets a fully typed payload — no more `as {...}` casts.
 */

export const metricLoggedPayloadSchema = z.object({
  runId: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  keys: z.array(z.string()),
  count: z.number().int().nonnegative(),
});

export const runFinishedPayloadSchema = z.object({
  runId: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  status: z.string(),
});

export const artifactUploadedPayloadSchema = z.object({
  artifactVersionId: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  fileCount: z.number().int().nonnegative(),
  digest: z.string(),
});

export const launchRunClaimedPayloadSchema = z.object({
  launchRunId: z.string(),
  queueId: z.string(),
});

export const jobPayloadSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("metric.logged"), payload: metricLoggedPayloadSchema }),
  z.object({ name: z.literal("run.finished"), payload: runFinishedPayloadSchema }),
  z.object({ name: z.literal("artifact.uploaded"), payload: artifactUploadedPayloadSchema }),
  z.object({ name: z.literal("launch.run.claimed"), payload: launchRunClaimedPayloadSchema }),
]);

export type JobPayload = z.infer<typeof jobPayloadSchema>;
export type JobName = JobPayload["name"];
export type JobPayloadByName = {
  "metric.logged": z.infer<typeof metricLoggedPayloadSchema>;
  "run.finished": z.infer<typeof runFinishedPayloadSchema>;
  "artifact.uploaded": z.infer<typeof artifactUploadedPayloadSchema>;
  "launch.run.claimed": z.infer<typeof launchRunClaimedPayloadSchema>;
};

export interface JobContext {
  prisma: PrismaClient;
  metricStorage: MetricStorage;
  timeSeriesStorage: TimeSeriesStorage;
  cache: Cache;
  /** Structured logger; injected from the worker composition root. */
  logger: FastifyBaseLogger;
}

/**
 * A processor for a specific job name. The `process` payload type is
 * narrowed via `JobPayloadByName[N]` so the implementation cannot accidentally
 * receive `unknown`.
 */
export interface JobProcessor<N extends JobName = JobName> {
  readonly name: N;
  process(payload: JobPayloadByName[N], ctx: JobContext): Promise<void>;
}

/** Untyped processor shape (used by the registry, which is keyed by name). */
export interface AnyJobProcessor {
  readonly name: JobName;
  process(payload: unknown, ctx: JobContext): Promise<void>;
}

/**
 * Convenience helper: build a strongly-typed processor from an impl.
 *  processJob("metric.logged", async (payload, ctx) => { ... })
 */
export function processJob<N extends JobName>(
  name: N,
  impl: (payload: JobPayloadByName[N], ctx: JobContext) => Promise<void>,
): JobProcessor<N> {
  return {
    name,
    process: impl as JobProcessor<N>["process"],
  };
}

// Re-export the known event type for callers that want to derive a job
// payload from a domain event without re-typing the fields.
export type { KnownDomainEvent };