import type { KnownDomainEvent } from "../core/events/domain-event.js";

export type JobPayload =
  | { name: "metric.logged"; payload: Extract<KnownDomainEvent, { type: "MetricLogged" }>["payload"] }
  | { name: "run.finished"; payload: Extract<KnownDomainEvent, { type: "RunFinished" }>["payload"] }
  | { name: "artifact.uploaded"; payload: Extract<KnownDomainEvent, { type: "ArtifactUploaded" }>["payload"] };

export interface JobContext {
  prisma: import("../generated/prisma/index.js").PrismaClient;
  metricStorage: import("../core/storage/metric-storage.js").MetricStorage;
  timeSeriesStorage: import("../core/storage/time-series-storage.js").TimeSeriesStorage;
  cache: import("../core/cache/cache.js").Cache;
}

export interface JobProcessor {
  name: string;
  process(job: { name: string; payload: unknown }, ctx: JobContext): Promise<void>;
}
