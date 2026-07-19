import type { MetricStorage } from "../../core/storage/metric-storage.js";
import type { EventBus } from "../../core/bus/event-bus.js";
import type { Queue } from "../../core/queue/queue.js";
import type { LogMetricsInput } from "./schema.js";

export class MetricService {
  constructor(
    private readonly storage: MetricStorage,
    private readonly eventBus: EventBus,
    private readonly queue: Queue,
  ) {}

  async log(
    runId: string,
    projectId: string,
    workspaceId: string,
    data: LogMetricsInput,
  ) {
    const records = data.metrics.map((m) => ({
      key: m.key,
      step: m.step,
      value: m.value,
    }));

    await this.storage.insertMetrics(runId, projectId, records);

    const event = {
      type: "MetricLogged" as const,
      payload: {
        runId,
        projectId,
        workspaceId,
        keys: records.map((r) => r.key),
        count: records.length,
      },
      occurredAt: new Date(),
    };

    await this.eventBus.publish(event);
    await this.queue.enqueue({ name: "metric.logged", payload: event.payload });
  }

  async list(runId: string, params: { keys?: string[]; limit: number }) {
    return this.storage.listMetrics(runId, params);
  }
}
