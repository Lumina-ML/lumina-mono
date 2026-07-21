import type { PrismaClient } from "../../generated/prisma/index.js";
import type { EventBus } from "../../core/bus/event-bus.js";
import type { Queue } from "../../core/queue/queue.js";
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
    /**
     * Durable job queue. Optional during the legacy construction sites;
     * the composition root (`apps/server/src/plugins/di.ts`) wires the
     * real implementation in. Without this, the durable side of
     * `run.finished` (cache invalidation hooks, analytics aggregators)
     * silently no-ops — events still publish on the in-process bus.
     */
    private readonly queue?: Queue,
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

    if (data.status && (TERMINAL_STATUSES as readonly string[]).includes(data.status)) {
      const workspaceId = run.project?.workspaceId ?? this.defaultWorkspaceId ?? "";
      const payload = {
        runId: run.runId,
        projectId: run.projectId,
        workspaceId,
        status: data.status,
      };
      // Publish for in-process subscribers (websocket fanout etc.).
      if (this.eventBus) {
        await this.eventBus.publish({
          type: "RunFinished",
          payload,
          occurredAt: new Date(),
        });
      }
      // Enqueue durable job for side effects (cache invalidation, analytics).
      // Decoupled from the event so a failed subscriber doesn't block the
      // queue path and vice versa.
      if (this.queue) {
        await this.queue.enqueue({ name: "run.finished", payload });
      }
    }

    return run;
  }

  async finish(runId: string) {
    const run = await this.repository.updateByRunId(runId, { status: "finished" });

    const workspaceId = run.project?.workspaceId ?? this.defaultWorkspaceId ?? "";
    const payload = {
      runId: run.runId,
      projectId: run.projectId,
      workspaceId,
      status: "finished",
    };
    if (this.eventBus) {
      await this.eventBus.publish({
        type: "RunFinished",
        payload,
        occurredAt: new Date(),
      });
    }
    if (this.queue) {
      await this.queue.enqueue({ name: "run.finished", payload });
    }

    return run;
  }
}

const TERMINAL_STATUSES = ["finished", "failed", "crashed", "killed"] as const;