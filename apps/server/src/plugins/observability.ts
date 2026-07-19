import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as promClient from "prom-client";

declare module "fastify" {
  interface FastifyRequest {
    reqId: string;
  }
}

export const observabilityPlugin = fp(async (app: FastifyInstance) => {
  const config = app.config;

  // Request ID
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const id = (req.headers[config.requestIdHeader.toLowerCase()] as string) || randomUUID();
    req.reqId = id;
    reply.header(config.requestIdHeader, id);
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

  // Health check with dependency probes
  app.get("/healthz", async () => {
    const checks: Record<string, "ok" | "error"> = {
      database: "ok",
      storage: "ok",
    };

    try {
      await app.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.database = "error";
    }

    try {
      // Probe storage by generating a presigned URL for a test key.
      await app.storage.getDownloadUrl("__health_check__");
    } catch {
      checks.storage = "error";
    }

    const status = Object.values(checks).every((c) => c === "ok") ? "ok" : "error";
    return { status, checks };
  });

  // Prometheus metrics endpoint
  if (config.metricsEnabled) {
    app.get(config.metricsPath, async (_req, reply) => {
      const metrics = await promClient.register.metrics();
      reply.type(promClient.register.contentType).send(metrics);
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
