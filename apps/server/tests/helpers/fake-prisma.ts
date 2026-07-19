import type { PrismaClient } from "../../src/generated/prisma/index.js";
import { uuidv7 } from "../../src/shared/uuid7.js";

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
    findUnique: async () => null,
    create: async () => null,
    findFirst: async () => null,
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