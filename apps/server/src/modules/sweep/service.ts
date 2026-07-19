import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateSweepInput,
  UpdateSweepInput,
  SweepConfig,
  Observation,
  ListSweepsQuery,
} from "./schema.js";
import { SweepRepository } from "./repository.js";
import { suggestNext, shouldEarlyTerminate } from "./optimizer.js";
import type { Prisma } from "../../generated/prisma/index.js";

type JsonObject = Prisma.JsonObject;
type JsonValue = Prisma.JsonValue;

export class SweepService {
  private readonly repository: SweepRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new SweepRepository(prisma);
  }

  async create(projectId: string, data: CreateSweepInput) {
    return this.repository.create(projectId, data);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async listByProject(projectId: string) {
    return this.repository.listByProject(projectId);
  }

  async list(params: ListSweepsQuery & { workspaceId?: string }) {
    return this.repository.list(params);
  }

  async update(id: string, data: UpdateSweepInput) {
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    return this.repository.delete(id);
  }

  /**
   * Return every run attached to the sweep as (params, metric) tuples so
   * distributed agents can use them as observations for the next suggestion.
   */
  async listObservations(sweepId: string): Promise<Observation[]> {
    const sweep = await this.repository.findById(sweepId);
    if (!sweep) throw new Error(`Sweep not found: ${sweepId}`);

    const cfg = (sweep.config ?? {}) as SweepConfig;
    const goal = cfg.metric?.goal ?? "minimize";
    const metricName = cfg.metric?.name ?? "_metric";

    return sweep.runs
      .map((run) => {
        const params = (run.config ?? {}) as Record<string, unknown>;
        const summary = (run.summary ?? {}) as JsonObject;
        const raw = summary[metricName] as JsonValue | undefined;
        const metric =
          typeof raw === "number"
            ? raw
            : typeof raw === "string" && raw !== ""
              ? Number(raw)
              : null;
        const observation: Observation = {
          runId: run.runId,
          params,
          metric,
          status: run.status,
          createdAt: run.createdAt,
        };
        return observation;
      })
      // Newest first so callers can `slice(-N)` for the most recent.
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Server-side Bayesian suggestion. Falls back to Latin Hypercube Sampling
   * when there aren't enough observations to fit a Gaussian Process
   * surrogate.
   */
  async suggestNext(sweepId: string, count: number): Promise<Array<Record<string, unknown>>> {
    const sweep = await this.repository.findById(sweepId);
    if (!sweep) throw new Error(`Sweep not found: ${sweepId}`);

    const observations = await this.listObservations(sweepId);
    const config = sweep.config as SweepConfig;
    const goal = config?.metric?.goal ?? "minimize";

    return suggestNext({
      config,
      observations: observations.map((o) => ({
        params: o.params as Record<string, number>,
        metric: o.metric,
      })),
      goal,
      count,
    });
  }

  async evaluateEarlyTermination(
    sweepId: string,
    runId: string,
    step: number,
    currentMetric: number,
  ): Promise<{ shouldTerminate: boolean; reason?: string }> {
    const sweep = await this.repository.findById(sweepId);
    if (!sweep) throw new Error(`Sweep not found: ${sweepId}`);
    const config = sweep.config as SweepConfig;
    if (!config?.early_terminate) return { shouldTerminate: false };

    const observations = await this.listObservations(sweepId);
    return shouldEarlyTerminate({
      observations: observations
        .filter((o) => o.runId !== runId)
        .map((o) => ({ params: o.params as Record<string, number>, metric: o.metric })),
      runId,
      step,
      currentMetric,
      config,
      goal: config?.metric?.goal ?? "minimize",
    });
  }

  async recordBestRun(sweepId: string): Promise<string | null> {
    const sweep = await this.repository.findById(sweepId);
    if (!sweep) throw new Error(`Sweep not found: ${sweepId}`);
    const config = sweep.config as SweepConfig;
    if (!config?.metric) return null;
    const observations = await this.listObservations(sweepId);
    const finished = observations.filter((o) => typeof o.metric === "number");
    if (finished.length === 0) return null;
    const goal = config.metric.goal;
    const best = finished.reduce((acc, o) =>
      goal === "minimize"
        ? (o.metric as number) < (acc.metric as number)
          ? o
          : acc
        : (o.metric as number) > (acc.metric as number)
          ? o
          : acc,
    );
    if (sweep.bestRunId !== best.runId) {
      await this.repository.update(sweepId, { bestRunId: best.runId });
    }
    return best.runId;
  }
}