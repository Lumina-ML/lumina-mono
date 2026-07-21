import { inject, injectable } from "tsyringe";
import type { MetricStorage } from "../../core/storage/metric-storage.js";
import type { EventBus } from "../../core/bus/event-bus.js";
import type { Queue } from "../../core/queue/queue.js";
import { TOKENS } from "../../core/di/tokens.js";
import type { LogMetricsInput, CompareMetricsInput } from "./schema.js";

@injectable()
export class MetricService {
  constructor(
    @inject(TOKENS.MetricStorage) private readonly storage: MetricStorage,
    @inject(TOKENS.EventBus) private readonly eventBus: EventBus,
    @inject(TOKENS.Queue) private readonly queue: Queue,
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

  async compare(input: CompareMetricsInput) {
    const keys = normalizeKeys(input.keys);
    const results = await Promise.all(
      input.runIds.map((runId) =>
        this.storage.listMetrics(runId, { keys, limit: input.limit }),
      ),
    );
    return { runs: results };
  }
}

function normalizeKeys(keys: CompareMetricsInput["keys"]): string[] | undefined {
  if (!keys) return undefined;
  if (Array.isArray(keys)) {
    return keys.flatMap((k) => k.split(",")).map((k) => k.trim()).filter(Boolean);
  }
  return keys.split(",").map((k) => k.trim()).filter(Boolean);
}
