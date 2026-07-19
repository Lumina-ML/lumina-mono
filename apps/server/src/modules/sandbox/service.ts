import type { PrismaClient } from "../../generated/prisma/index.js";
import type { TraceStorage } from "../../core/storage/trace-storage.js";
import {
  type DemoScenario,
  type DemoRunResult,
  purgeDemoProject,
  runDemoScenario,
} from "./runners.js";

/**
 * Thin orchestration layer for the demo sandbox endpoints. Routes call
 * into here so the HTTP boundary stays declarative (validation +
 * response shaping) and so business logic (which project to target,
 * what to do on reset) is testable without spinning up Fastify.
 *
 * The `__demo__` project is looked up by name within the active
 * workspace (Roadmap §MVP-2 D3 — every demo card writes into the same
 * playground project). If it doesn't exist (someone deleted it), we
 * re-seed it on demand so the button keeps working.
 */
export class SandboxService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly traceStorage: TraceStorage,
  ) {}

  async runExample(
    workspaceId: string,
    scenario: DemoScenario,
  ): Promise<DemoRunResult> {
    const projectId = await this.ensureDemoProjectId(workspaceId);
    return runDemoScenario(scenario, projectId, {
      prisma: this.prisma,
      traceStorage: this.traceStorage,
    });
  }

  async resetDemo(
    workspaceId: string,
    projectId: string,
  ): Promise<Awaited<ReturnType<typeof purgeDemoProject>>> {
    // Verify the project belongs to this workspace before wiping.
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true, name: true },
    });
    if (!project) {
      const err = new Error("Demo project not found");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    if (project.workspaceId !== workspaceId) {
      const err = new Error("Demo project belongs to another workspace");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    return purgeDemoProject(projectId, this.prisma);
  }

  private async ensureDemoProjectId(workspaceId: string): Promise<string> {
    const { ensureDemoProject } = await import("../../core/seed/demo-seed.js");
    const { projectId } = await ensureDemoProject(this.prisma, workspaceId);
    return projectId;
  }
}