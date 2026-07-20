import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    reqId: string;
  }
}

export const observabilityPlugin = fp(async (app: FastifyInstance) => {
  const config = app.config;

  // Request ID. `req.id` is already resolved by `genReqId` in bootstrap
  // (honoring the inbound request-id header, else a fresh UUID) and is
  // bound onto the per-request child logger. Mirror it onto `req.reqId`
  // for consumers that read that field (otel spans) and echo it back on
  // the response so clients can correlate.
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    req.reqId = req.id;
    reply.header(config.requestIdHeader, req.id);
  });

  // Request timing & logging
  app.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
    const durationMs = reply.elapsedTime;
    const route = req.routerPath ?? req.url;
    const labels = {
      method: req.method,
      route,
      status_code: reply.statusCode,
    };

    app.telemetry.counter("http_requests_total", 1, labels);
    app.telemetry.histogram("http_request_duration_seconds", durationMs / 1000, labels);

    req.log.info({
      reqId: req.reqId,
      method: req.method,
      url: req.url,
      route,
      statusCode: reply.statusCode,
      durationMs,
    }, "request completed");
  });

  // Health endpoints (`/healthz`, `/readyz`) live in the dedicated
  // `healthPlugin` — it does the same dependency probes plus more
  // (ClickHouse, Redis), and registers them at the root prefix. The
  // previous duplicate registration here would crash Fastify on the
  // second `app.get("/healthz", …)` call when both plugins were
  // loaded; this stub is intentionally absent.

  // Prometheus metrics endpoint. Reads from the per-app telemetry
  // registry (the same one PrometheusTelemetry writes into) instead of
  // the global `promClient.register` — multiple `buildApp()` calls in
  // the same process (E2E test files) each have their own.
  if (config.metricsEnabled) {
    app.get(config.metricsPath, async (_req, reply) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const registry = (app.telemetry as any).registry as
        | { metrics(): Promise<string>; contentType: string }
        | undefined;
      if (!registry) {
        reply.status(503).send("# no telemetry registry attached\n");
        return;
      }
      const metrics = await registry.metrics();
      reply.type(registry.contentType).send(metrics);
    });
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "received shutdown signal, closing server...");
    try {
      await app.close();
      app.log.info("server closed gracefully");
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});
