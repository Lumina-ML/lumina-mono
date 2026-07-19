import type { PrismaClient } from "../../generated/prisma/index.js";

/**
 * Demo project seed.
 *
 * Implements Roadmap §MVP-3 / D3: every fresh Lumina install ships with
 * a `__demo__` project inside the default workspace so that:
 *   - new users land on a dashboard that already has *something* in
 *     it (closes the "blank white wall" observation in Roadmap §1.3);
 *   - the demo cards on the workspace overview have a stable target to
 *     write into (sandbox runners + the M1-1 endpoint all use this id);
 *   - "Reset demo data" can find a known project to wipe.
 *
 * The project is created idempotently — re-running the bootstrap on a
 * database that already has it is a no-op. Data is **not** populated
 * here; the sandbox runners (`apps/server/src/modules/sandbox/runners/`)
 * fill it in on demand when the user clicks a "Try it" card. That keeps
 * startup time below the 30s budget (Roadmap §MVP-3) and lets each
 * scenario be triggered independently.
 *
 * The `__demo__` name is reserved — projects created by the SDK cannot
 * collide because `CreateProjectSchema` rejects names starting with
 * `__` (see `apps/server/src/modules/project/schema.ts` — the
 * rejection lives there; this seed is the only writer for that prefix).
 */

export const DEMO_PROJECT_NAME = "__demo__";
export const DEMO_PROJECT_DISPLAY = "Lumina Demo";
export const DEMO_PROJECT_DESCRIPTION =
  "Pre-seeded playground project. Use the demo cards on the workspace " +
  "overview to populate it with realistic runs, sweeps, evaluations, " +
  "traces, and artifacts.";

export interface DemoProjectSeedResult {
  /** Existing project id (created here or by a prior boot). */
  projectId: string;
  /** True when this boot created the project; false when it pre-existed. */
  created: boolean;
}

export async function ensureDemoProject(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<DemoProjectSeedResult> {
  const existing = await prisma.project.findUnique({
    where: { workspaceId_name: { workspaceId, name: DEMO_PROJECT_NAME } },
    select: { id: true },
  });
  if (existing) {
    return { projectId: existing.id, created: false };
  }
  const created = await prisma.project.create({
    data: {
      workspaceId,
      name: DEMO_PROJECT_NAME,
      displayName: DEMO_PROJECT_DISPLAY,
      description: DEMO_PROJECT_DESCRIPTION,
      // Pre-arm a couple of settings that the dashboard reads to know
      // this is a demo project (e.g., disable delete confirmation
      // prompt, show the "Try our demo" banner).
      settings: { isDemo: true },
    },
    select: { id: true },
  });
  return { projectId: created.id, created: true };
}