/**
 * Symbol-keyed dependency-injection tokens. Registered by
 * `apps/server/src/plugins/di.ts` against the `container` from
 * `apps/server/src/core/di/container.ts`. Services depend on these via
 * constructor `@inject(TOKENS.X)` so a test or alternative composition
 * root can swap them out without touching service code.
 */
export const TOKENS = {
  PrismaClient: Symbol("PrismaClient"),
  EventBus: Symbol("EventBus"),
  Queue: Symbol("Queue"),
  Cache: Symbol("Cache"),
  MetricStorage: Symbol("MetricStorage"),
  TimeSeriesStorage: Symbol("TimeSeriesStorage"),
  TraceStorage: Symbol("TraceStorage"),
  Storage: Symbol("Storage"),
  Telemetry: Symbol("Telemetry"),
  Logger: Symbol("Logger"),
  defaultWorkspaceId: Symbol("defaultWorkspaceId"),
} as const;

export type TokenName = keyof typeof TOKENS;
export type Token = (typeof TOKENS)[TokenName];