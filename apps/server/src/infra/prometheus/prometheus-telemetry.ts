import * as promClient from "prom-client";
import type { Labels, Telemetry } from "../../core/telemetry/telemetry.js";

export class PrometheusTelemetry implements Telemetry {
  private readonly histograms = new Map<string, promClient.Histogram<string>>();
  private readonly counters = new Map<string, promClient.Counter<string>>();
  private readonly gauges = new Map<string, promClient.Gauge<string>>();

  constructor(register: promClient.Registry = promClient.register) {
    promClient.collectDefaultMetrics({ register });
  }

  histogram(name: string, value: number, labels?: Labels): void {
    const histogram = this.getOrCreateHistogram(name);
    if (labels) {
      histogram.observe(this.sanitizeLabels(labels), value);
    } else {
      histogram.observe(value);
    }
  }

  counter(name: string, delta = 1, labels?: Labels): void {
    const counter = this.getOrCreateCounter(name);
    if (labels) {
      counter.inc(this.sanitizeLabels(labels), delta);
    } else {
      counter.inc(delta);
    }
  }

  gauge(name: string, value: number, labels?: Labels): void {
    const gauge = this.getOrCreateGauge(name);
    if (labels) {
      gauge.set(this.sanitizeLabels(labels), value);
    } else {
      gauge.set(value);
    }
  }

  private getOrCreateHistogram(name: string): promClient.Histogram<string> {
    const existing = this.histograms.get(name);
    if (existing) return existing;

    const histogram = new promClient.Histogram({
      name,
      help: `Histogram for ${name}`,
      labelNames: ["method", "route", "status_code"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });
    this.histograms.set(name, histogram);
    return histogram;
  }

  private getOrCreateCounter(name: string): promClient.Counter<string> {
    const existing = this.counters.get(name);
    if (existing) return existing;

    const counter = new promClient.Counter({
      name,
      help: `Counter for ${name}`,
      labelNames: ["method", "route", "status_code"],
    });
    this.counters.set(name, counter);
    return counter;
  }

  private getOrCreateGauge(name: string): promClient.Gauge<string> {
    const existing = this.gauges.get(name);
    if (existing) return existing;

    const gauge = new promClient.Gauge({
      name,
      help: `Gauge for ${name}`,
      labelNames: ["method", "route", "status_code"],
    });
    this.gauges.set(name, gauge);
    return gauge;
  }

  private sanitizeLabels(labels: Labels): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(labels)) {
      if (value !== undefined) {
        result[key] = String(value);
      }
    }
    return result;
  }
}
