import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Telemetry } from "../core/telemetry/telemetry.js";
import { PrometheusTelemetry } from "../infra/prometheus/prometheus-telemetry.js";

declare module "fastify" {
  interface FastifyInstance {
    telemetry: Telemetry;
  }
}

export const telemetryPlugin = fp(async (app: FastifyInstance) => {
  const telemetry = app.config.metricsEnabled ? new PrometheusTelemetry() : new NoopTelemetry();
  app.decorate("telemetry", telemetry as any);
});

class NoopTelemetry implements Telemetry {
  histogram(): void { }
  counter(): void { }
  gauge(): void { }
}
