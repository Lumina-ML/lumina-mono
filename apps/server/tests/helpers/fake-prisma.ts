import type { PrismaClient } from "../../src/generated/prisma/index.js";
import { uuidv7 } from "../../src/shared/uuid7.js";

interface FakeProjectRow {
  id: string;
  workspaceId: string;
  name: string;
  displayName: string | null;
  description: string | null;
  settings: Record<string, unknown>;
}

/**
 * Minimal in-memory Prisma replacement that supports the operations the
 * server modules need in tests. Each model is a Map keyed by its primary
 * lookup (id, runId, etc.) and supports the subset of the PrismaClient API
 * that RunService / RunRepository / ProjectService actually call.
 *
 * Tests that need only the read-by-runId path can pass a single seeded run
 * via `seedRun({ runId, projectId })`.
 */
export function createFakePrisma(options: {
  runs?: Array<{ runId: string; projectId: string; name?: string }>;
  projects?: Array<{ id?: string; workspaceId?: string; name: string }>;
} = {}): PrismaClient {
  const runsByRunId = new Map<string, FakeRunRow>();
  const runsById = new Map<string, FakeRunRow>();

  for (const r of options.runs ?? []) {
    const id = uuidv7();
    const row: FakeRunRow = {
      id,
      runId: r.runId,
      projectId: r.projectId,
      name: r.name ?? "test-run",
      status: "running",
      config: {},
      summary: {},
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    runsByRunId.set(r.runId, row);
    runsById.set(id, row);
  }

  const projectsById = new Map<string, FakeProjectRow>();
  for (const p of options.projects ?? []) {
    const id = p.id ?? uuidv7();
    const row: FakeProjectRow = {
      id,
      workspaceId: p.workspaceId ?? "default",
      name: p.name,
      displayName: null,
      description: null,
      settings: {},
    };
    projectsById.set(id, row);
  }

  const runModel = {
    findUnique: async ({ where, include }: {
      where: { runId?: string; id?: string };
      include?: unknown;
    }) => {
      const row = where.runId ? runsByRunId.get(where.runId) : where.id ? runsById.get(where.id) : undefined;
      if (!row) return null;
      // Strip include since the tests don't actually need it.
      return row;
    },
    create: async ({ data }: { data: Partial<FakeRunRow> }) => {
      const id = data.id ?? uuidv7();
      const row: FakeRunRow = {
        id,
        runId: data.runId ?? uuidv7(),
        projectId: data.projectId!,
        name: data.name ?? "run",
        status: data.status ?? "running",
        config: data.config ?? {},
        summary: data.summary ?? {},
        metadata: data.metadata ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      runsByRunId.set(row.runId, row);
      runsById.set(id, row);
      return row;
    },
    update: async ({ where, data }: { where: { runId: string }; data: Partial<FakeRunRow> }) => {
      const row = runsByRunId.get(where.runId);
      if (!row) throw new Error(`Run ${where.runId} not found`);
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    findMany: async () => Array.from(runsByRunId.values()),
    count: async () => runsByRunId.size,
    delete: async ({ where }: { where: { runId: string } }) => {
      const row = runsByRunId.get(where.runId);
      if (row) {
        runsByRunId.delete(where.runId);
        runsById.delete(row.id);
      }
      return row;
    },
  };

  const workspaceModel = {
    upsert: async ({ where, create, update }: {
      where: { id?: string; name?: string };
      create: { id: string; name: string; displayName?: string };
      update: object;
    }) => {
      return { id: where.id ?? "default", name: create.name, displayName: create.displayName ?? null };
    },
  };

  const projectModel = {
    findUnique: async ({ where }: { where: { id?: string; workspaceId_name?: { workspaceId: string; name: string } } }) => {
      if (where.id) return projectsById.get(where.id) ?? null;
      if (where.workspaceId_name) {
        return (
          Array.from(projectsById.values()).find(
            (p) =>
              p.workspaceId === where.workspaceId_name!.workspaceId &&
              p.name === where.workspaceId_name!.name,
          ) ?? null
        );
      }
      return null;
    },
    findFirst: async ({ where }: { where?: { workspaceId?: string } } = {}) => {
      const all = Array.from(projectsById.values());
      if (where?.workspaceId) {
        return all.find((p) => p.workspaceId === where.workspaceId) ?? null;
      }
      return all[0] ?? null;
    },
    create: async ({ data }: { data: Partial<FakeProjectRow> }) => {
      const row: FakeProjectRow = {
        id: data.id ?? uuidv7(),
        workspaceId: data.workspaceId ?? "default",
        name: data.name ?? "project",
        displayName: data.displayName ?? null,
        description: data.description ?? null,
        settings: data.settings ?? {},
      };
      projectsById.set(row.id, row);
      return row;
    },
    findMany: async () => Array.from(projectsById.values()),
    count: async () => projectsById.size,
    update: async ({ where, data }: { where: { id: string }; data: Partial<FakeProjectRow> }) => {
      const row = projectsById.get(where.id);
      if (!row) throw new Error(`Project ${where.id} not found`);
      Object.assign(row, data);
      return row;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const row = projectsById.get(where.id);
      if (row) projectsById.delete(where.id);
      return row;
    },
  };

  // We return a cast object; only the methods above are accessed.
  return {
    run: runModel,
    workspace: workspaceModel,
    project: projectModel,
  } as unknown as PrismaClient;
}

export interface FakeRunRow {
  id: string;
  runId: string;
  projectId: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}