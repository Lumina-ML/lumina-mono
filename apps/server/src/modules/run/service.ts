import type { PrismaClient } from "../../generated/prisma/index.js";
import type { EventBus } from "../../core/bus/event-bus.js";
import type { CreateRunInput, UpdateRunInput } from "./schema.js";
import { RunRepository } from "./repository.js";

export class RunService {
  private readonly repository: RunRepository;

  constructor(
    prisma: PrismaClient,
    private readonly eventBus?: EventBus,
    /**
     * Fallback workspaceId used when an event payload can't resolve one
     * from the run's project (e.g. legacy callers or a publish path that
     * happens before the include is available). Usually
     * `app.config.defaultWorkspaceId`. Optional so older construction
     * sites (system-metric / log-line routes) still type-check.
     */
    private readonly defaultWorkspaceId?: string,
  ) {
    this.repository = new RunRepository(prisma);
  }

  async create(projectId: string, data: CreateRunInput) {
    const run = await this.repository.create(projectId, data);

    if (this.eventBus) {
      const workspaceId =
        (await this.repository.findByRunId(run.runId))?.project?.workspaceId
        ?? this.defaultWorkspaceId
        ?? "";
      await this.eventBus.publish({
        type: "RunCreated",
        payload: { runId: run.runId, projectId, workspaceId },
        occurredAt: new Date(),
      });
    }

    return run;
  }

  async getByRunId(runId: string) {
    return this.repository.findByRunId(runId);
  }

  async getById(id: string) {
    return this.repository.findById(id);
  }

  async list(params: {
    projectId?: string;
    status?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    limit: number;
    offset: number;
  }) {
    return this.repository.list(params);
  }

  async delete(runId: string) {
    return this.repository.deleteByRunId(runId);
  }

  async update(runId: string, data: UpdateRunInput) {
    const run = await this.repository.updateByRunId(runId, data);

    if (this.eventBus && data.status && ["finished", "failed", "crashed", "killed"].includes(data.status)) {
      const workspaceId = run.project?.workspaceId ?? this.defaultWorkspaceId ?? "";
      await this.eventBus.publish({
        type: "RunFinished",
        payload: {
          runId: run.runId,
          projectId: run.projectId,
          workspaceId,
          status: data.status,
        },
        occurredAt: new Date(),
      });
    }

    return run;
  }

  async finish(runId: string) {
    const run = await this.repository.updateByRunId(runId, { status: "finished" });

    if (this.eventBus) {
      const workspaceId = run.project?.workspaceId ?? this.defaultWorkspaceId ?? "";
      await this.eventBus.publish({
        type: "RunFinished",
        payload: {
          runId: run.runId,
          projectId: run.projectId,
          workspaceId,
          status: "finished",
        },
        occurredAt: new Date(),
      });
    }

    return run;
  }
}
