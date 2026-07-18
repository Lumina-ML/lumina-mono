import type { MetricStorage } from "../../core/storage/metric-storage.js";
import type { EventBus } from "../../core/bus/event-bus.js";
import type { LogMetricsInput } from "./schema.js";

export class MetricService {
  constructor(
    private readonly storage: MetricStorage,
    private readonly eventBus: EventBus,
  ) {}

  async log(runId: string, projectId: string, data: LogMetricsInput) {
    const records = data.metrics.map((m) => ({
      key: m.key,
      step: m.step,
      value: m.value,
    }));

    await this.storage.insertMetrics(runId, projectId, records);

    await this.eventBus.publish({
      type: "MetricLogged",
      payload: {
        runId,
        projectId,
        keys: records.map((r) => r.key),
        count: records.length,
      },
      occurredAt: new Date(),
    });
  }

  async list(runId: string, params: { keys?: string[]; limit: number }) {
    return this.storage.listMetrics(runId, params);
  }
}
