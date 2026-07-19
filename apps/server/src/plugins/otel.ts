/**
 * OpenTelemetry tracing bootstrap.
 *
 * Why this plugin:
 * - `@opentelemetry/api` is the only OTEL package we ship with the
 *   server. It exposes a stable `trace.getTracer(name)` API but does
 *   not implement any actual tracer. That keeps the binary small and
 *   avoids forcing every self-hosting user to run a collector.
 * - When the operator wants real traces, they set
 *   `OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318/v1/traces`
 *   (plus `OTEL_SERVICE_NAME=lumina-server`) and install the
 *   `@opentelemetry/sdk-node` + `@opentelemetry/exporter-trace-otlp-http`
 *   packages into the server's node_modules. The SDK's auto-init
 *   detects these env vars and registers itself as the global tracer
 *   provider before this plugin runs — so we just call
 *   `trace.getTracer("lumina-server")` and get either a real exporter
 *   or the API's NoopTracer.
 * - Without those env vars set, spans are recorded into NoopTracer
 *   (zero overhead) so production code can still call `tracer.startSpan`
 *   unconditionally.
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

export const otelPlugin = fp(async (app: FastifyInstance) => {
  // `trace.getTracer` returns the globally-registered provider's tracer,
  // or NoopTracer if no SDK has registered itself. Operators enable the
  // real exporter by setting OTEL_* env vars and installing the SDK
  // packages — see the plugin docstring.
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