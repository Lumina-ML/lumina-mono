import type { Telemetry } from "../../core/telemetry/telemetry.js";

/**
 * NoopTelemetry — used when METRICS_ENABLED=false or in tests.
 * Method signatures match PrometheusTelemetry but do nothing.
 */
export class NoopTelemetry implements Telemetry {
  histogram(): void {}
  counter(): void {}
  gauge(): void {}
}