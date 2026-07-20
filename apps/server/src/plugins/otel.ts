/**
 * OpenTelemetry tracing bootstrap.
 *
 * Behavior:
 * - If `OTEL_EXPORTER_OTLP_ENDPOINT` is set, the plugin dynamically loads
 *   `@opentelemetry/sdk-node` + `@opentelemetry/exporter-trace-otlp-http`,
 *   creates a `NodeSDK`, and starts it. All spans created by this plugin
 *   are then exported to the configured collector.
 * - If the endpoint env var is missing, no SDK is initialized and
 *   `trace.getTracer` returns the API's `NoopTracer` (zero overhead).
 * - If the SDK packages are not installed or initialization fails, the
 *   plugin logs a warning and falls back to the NoopTracer so the server
 *   keeps running.
 *
 * Operators configure tracing via:
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318/v1/traces
 *   OTEL_SERVICE_NAME=lumina-server   # optional, defaults to "lumina-server"
 *
 * Spans are added to every HTTP request via Fastify hooks. The span
 * carries the HTTP method, route, status code, and request id, so an
 * operator can correlate one trace with their existing Fastify
 * `req.reqId` log line.
 */
import fp from "fastify-plugin";
import { trace, type Tracer } from "@opentelemetry/api";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    tracer: Tracer;
  }
  interface FastifyRequest {
    otelSpan?: ReturnType<Tracer["startSpan"]>;
  }
}

const TRACER_NAME = "lumina-server";
const TRACER_VERSION = "0.1.0";

interface OtelSdk {
  start(): void;
  shutdown(): Promise<void>;
}

async function tryInitSdk(
  app: FastifyInstance,
): Promise<OtelSdk | undefined> {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return undefined;
  }

  try {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { OTLPTraceExporter } = await import(
      "@opentelemetry/exporter-trace-otlp-http"
    );
    const { Resource } = await import("@opentelemetry/resources");
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import(
      "@opentelemetry/semantic-conventions"
    );

    const serviceName = process.env.OTEL_SERVICE_NAME ?? TRACER_NAME;
    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({ url: endpoint }),
      resource: new Resource({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: TRACER_VERSION,
      }),
    });

    sdk.start();

    app.addHook("onClose", async () => {
      try {
        await sdk.shutdown();
      } catch (err) {
        app.log.warn({ err }, "Failed to shut down OpenTelemetry SDK");
      }
    });

    app.log.info(
      { endpoint, serviceName },
      "OpenTelemetry tracing initialized",
    );
    return sdk;
  } catch (err) {
    app.log.warn(
      { err },
      "OTEL_EXPORTER_OTLP_ENDPOINT is set but OpenTelemetry SDK could not be initialized; traces will be no-ops",
    );
    return undefined;
  }
}

export const otelPlugin = fp(async (app: FastifyInstance) => {
  await tryInitSdk(app);

  // `trace.getTracer` returns the globally-registered provider's tracer,
  // or NoopTracer if no SDK has registered itself.
  const tracer = trace.getTracer(TRACER_NAME, TRACER_VERSION);
  app.decorate("tracer", tracer);

  app.addHook("onRequest", async (req: FastifyRequest, _reply: FastifyReply) => {
    // `routerPath` is undefined until routing completes; fall back to
    // the raw URL so the first hop still has a span name. The hook
    // reuses the existing request id so log lines and trace ids line up.
    const span = tracer.startSpan(`HTTP ${req.method} ${req.url}`, {
      attributes: {
        "http.method": req.method,
        "http.target": req.url,
        "lumina.req_id": req.reqId,
      },
    });
    req.otelSpan = span;
  });

  app.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
    const span = req.otelSpan;
    if (!span) return;
    const route = req.routerPath ?? req.url;
    span.setAttribute("http.route", route);
    span.setAttribute("http.status_code", reply.statusCode);
    span.end();
  });

  app.addHook("onError", async (req: FastifyRequest, _reply: FastifyReply, err: Error) => {
    req.otelSpan?.recordException(err);
  });
});
