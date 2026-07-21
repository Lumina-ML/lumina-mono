import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { container } from "../core/di/container.js";
import { TOKENS } from "../core/di/tokens.js";

/**
 * Composition root: registers the Fastify-decorated infrastructure
 * instances (prisma, bus, queue, etc.) against the DI container's
 * symbol-keyed tokens. Runs *after* all infra plugins so every
 * `app.<thing>` is available, but *before* any business-module route is
 * registered so services can be resolved by tsyringe at route-registration
 * time.
 *
 * Tokens live in `core/di/tokens.ts`; the same tokens are consumed by
 * service constructors via `@inject(TOKENS.X)`. Tests should call
 * `resetContainer()` in `beforeEach` and register mocks.
 */
export const diPlugin = fp(async (app: FastifyInstance) => {
  container.registerInstance(TOKENS.PrismaClient, app.prisma);
  container.registerInstance(TOKENS.EventBus, app.eventBus);
  container.registerInstance(TOKENS.Queue, app.queue);
  container.registerInstance(TOKENS.Cache, app.cache);
  if (app.metricStorage) {
    container.registerInstance(TOKENS.MetricStorage, app.metricStorage);
  }
  if (app.timeSeriesStorage) {
    container.registerInstance(TOKENS.TimeSeriesStorage, app.timeSeriesStorage);
  }
  if (app.traceStorage) {
    container.registerInstance(TOKENS.TraceStorage, app.traceStorage);
  }
  if (app.storage) {
    container.registerInstance(TOKENS.Storage, app.storage);
  }
  if (app.telemetry) {
    container.registerInstance(TOKENS.Telemetry, app.telemetry);
  }
  container.registerInstance(TOKENS.Logger, app.log);
  container.registerInstance(
    TOKENS.defaultWorkspaceId,
    app.config.defaultWorkspaceId,
  );

  app.addHook("onClose", async () => {
    container.reset();
  });
});