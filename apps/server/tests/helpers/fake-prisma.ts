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

interface FakeArtifactRow {
  id: string;
  projectId: string;
  name: string;
  type: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeArtifactVersionRow {
  id: string;
  artifactId: string;
  version: string;
  aliases: string[];
  metadata: Record<string, unknown>;
  state: string;
  digest: string | null;
  manifest: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeArtifactFileRow {
  id: string;
  artifactVersionId: string;
  path: string;
  size: bigint;
  md5: string | null;
  sha256: string | null;
  etag: string | null;
  referenceUri: string | null;
  contentType: string | null;
  storageKey: string | null;
  createdAt: Date;
}

interface FakeArtifactLineageRow {
  id: string;
  artifactVersionId: string;
  parentArtifactVersionId: string;
  type: string;
}

interface FakeSweepRow {
  id: string;
  projectId: string;
  name: string;
  method: string;
  config: Record<string, unknown>;
  state: string;
  bestRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeRunWithSweep {
  id: string;
  runId: string;
  sweepId: string;
  config: Record<string, unknown>;
  summary: Record<string, unknown>;
  status: string;
  createdAt: Date;
}

/**
 * Minimal in-memory Prisma replacement that supports the operations the
 * server modules need in tests. Each model is a Map keyed by its primary
 * lookup (id, runId, etc.) and supports the subset of the PrismaClient API
 * that the modules actually call.
 */
export function createFakePrisma(options: {
  runs?: Array<{ runId: string; projectId: string; name?: string }>;
  projects?: Array<{ id?: string; workspaceId?: string; name: string }>;
  artifacts?: Array<{
    id?: string;
    projectId: string;
    name: string;
    type?: string;
    description?: string;
  }>;
  artifactVersions?: Array<{
    id?: string;
    artifactId: string;
    version: string;
    aliases?: string[];
    metadata?: Record<string, unknown>;
    state?: string;
  }>;
  sweeps?: Array<{
    id?: string;
    projectId: string;
    name: string;
    method?: string;
    config?: Record<string, unknown>;
    state?: string;
  }>;
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

  const artifactsById = new Map<string, FakeArtifactRow>();
  for (const a of options.artifacts ?? []) {
    const id = a.id ?? uuidv7();
    const row: FakeArtifactRow = {
      id,
      projectId: a.projectId,
      name: a.name,
      type: a.type ?? "file",
      description: a.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    artifactsById.set(id, row);
  }

  const versionsById = new Map<string, FakeArtifactVersionRow>();
  for (const v of options.artifactVersions ?? []) {
    const id = v.id ?? uuidv7();
    const row: FakeArtifactVersionRow = {
      id,
      artifactId: v.artifactId,
      version: v.version,
      aliases: v.aliases ?? [],
      metadata: v.metadata ?? {},
      state: v.state ?? "committed",
      digest: null,
      manifest: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    versionsById.set(id, row);
  }

  const filesById = new Map<string, FakeArtifactFileRow>();
  const lineageById = new Map<string, FakeArtifactLineageRow>();
  const sweepsById = new Map<string, FakeSweepRow>();
  for (const s of options.sweeps ?? []) {
    const id = s.id ?? uuidv7();
    const row: FakeSweepRow = {
      id,
      projectId: s.projectId,
      name: s.name,
      method: s.method ?? "random",
      config: s.config ?? {},
      state: s.state ?? "running",
      bestRunId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    sweepsById.set(id, row);
  }
  // Runs already seeded in options.runs may need sweepId; we tag them via
  // the runModel by stamping a sweepId field. To keep things simple we
  // expose sweep-attached runs through the sweepModel itself.
  const sweepRuns: FakeRunWithSweep[] = [];

  const runModel = {
    findUnique: async ({ where }: { where: { runId?: string; id?: string } }) => {
      const row = where.runId ? runsByRunId.get(where.runId) : where.id ? runsById.get(where.id) : undefined;
      return row ?? null;
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
    upsert: async ({ where, create }: {
      where: { id?: string; name?: string };
      create: { id: string; name: string; displayName?: string };
      update: object;
    }) => ({ id: where.id ?? "default", name: create.name, displayName: create.displayName ?? null }),
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
      if (where?.workspaceId) return all.find((p) => p.workspaceId === where.workspaceId) ?? null;
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

  const artifactModel = {
    findUnique: async ({ where }: { where: { id?: string; projectId_name?: { projectId: string; name: string } } }) => {
      if (where.id) return artifactsById.get(where.id) ?? null;
      if (where.projectId_name) {
        return (
          Array.from(artifactsById.values()).find(
            (a) => a.projectId === where.projectId_name!.projectId && a.name === where.projectId_name!.name,
          ) ?? null
        );
      }
      return null;
    },
    findFirst: async ({ where }: { where?: { projectId?: string; name?: string } } = {}) => {
      const all = Array.from(artifactsById.values());
      return (
        all.find((a) =>
          (where?.projectId === undefined || a.projectId === where.projectId) &&
          (where?.name === undefined || a.name === where.name),
        ) ?? null
      );
    },
    create: async ({ data }: { data: Partial<FakeArtifactRow> }) => {
      const row: FakeArtifactRow = {
        id: data.id ?? uuidv7(),
        projectId: data.projectId!,
        name: data.name!,
        type: data.type ?? "file",
        description: data.description ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      artifactsById.set(row.id, row);
      return row;
    },
    findMany: async ({ where }: { where?: { projectId?: string } } = {}) => {
      const all = Array.from(artifactsById.values());
      const filtered = where?.projectId ? all.filter((a) => a.projectId === where.projectId) : all;
      return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  };

  const artifactVersionModel = {
    create: async ({ data }: { data: Partial<FakeArtifactVersionRow> }) => {
      const row: FakeArtifactVersionRow = {
        id: data.id ?? uuidv7(),
        artifactId: data.artifactId!,
        version: data.version!,
        aliases: data.aliases ?? [],
        metadata: data.metadata ?? {},
        state: data.state ?? "committed",
        digest: null,
        manifest: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      versionsById.set(row.id, row);
      return row;
    },
    findUnique: async ({ where, include }: { where: { id?: string }; include?: unknown }) => {
      const row = where.id ? versionsById.get(where.id) : null;
      if (!row) return null;
      if (include) return attachVersionIncludes(row, include);
      return row;
    },
    findFirst: async ({ where, include }: { where?: { artifactId?: string; aliases?: { has?: string } }; include?: unknown }) => {
      const all = Array.from(versionsById.values());
      const matched = all.find((v) => {
        if (where?.artifactId && v.artifactId !== where.artifactId) return false;
        if (where?.aliases?.has && !v.aliases.includes(where.aliases.has)) return false;
        return true;
      });
      if (!matched) return null;
      if (include) return attachVersionIncludes(matched, include);
      return matched;
    },
    findMany: async ({ where, include, orderBy }: { where?: { artifactId?: string }; include?: unknown; orderBy?: unknown } = {}) => {
      const all = Array.from(versionsById.values());
      const filtered = where?.artifactId ? all.filter((v) => v.artifactId === where.artifactId) : all;
      const sorted = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return sorted.map((v) => (include ? attachVersionIncludes(v, include) : v));
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<FakeArtifactVersionRow> }) => {
      const row = versionsById.get(where.id);
      if (!row) throw new Error(`ArtifactVersion ${where.id} not found`);
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
  };

  const artifactFileModel = {
    create: async ({ data }: { data: Partial<FakeArtifactFileRow> }) => {
      const row: FakeArtifactFileRow = {
        id: data.id ?? uuidv7(),
        artifactVersionId: data.artifactVersionId!,
        path: data.path!,
        size: data.size ?? 0n,
        md5: data.md5 ?? null,
        sha256: data.sha256 ?? null,
        etag: data.etag ?? null,
        referenceUri: data.referenceUri ?? null,
        contentType: data.contentType ?? null,
        storageKey: data.storageKey ?? null,
        createdAt: new Date(),
      };
      filesById.set(row.id, row);
      return row;
    },
    findUnique: async ({ where }: { where: { artifactVersionId_path?: { artifactVersionId: string; path: string } } }) => {
      if (where.artifactVersionId_path) {
        return (
          Array.from(filesById.values()).find(
            (f) =>
              f.artifactVersionId === where.artifactVersionId_path!.artifactVersionId &&
              f.path === where.artifactVersionId_path!.path,
          ) ?? null
        );
      }
      return null;
    },
    findFirst: async ({ where }: { where?: { artifactVersionId?: string; sha256?: string } }) => {
      return (
        Array.from(filesById.values()).find(
          (f) =>
            (where?.artifactVersionId === undefined || f.artifactVersionId === where.artifactVersionId) &&
            (where?.sha256 === undefined || f.sha256 === where.sha256),
        ) ?? null
      );
    },
    findMany: async ({ where }: { where?: { artifactVersionId?: string } } = {}) => {
      const all = Array.from(filesById.values()).filter((f) =>
        where?.artifactVersionId ? f.artifactVersionId === where.artifactVersionId : true,
      );
      return all.sort((a, b) => a.path.localeCompare(b.path));
    },
  };

  const artifactLineageModel = {
    upsert: async ({ where, create }: {
      where: { artifactVersionId_parentArtifactVersionId: { artifactVersionId: string; parentArtifactVersionId: string } };
      create: { artifactVersionId: string; parentArtifactVersionId: string; type: string };
      update: { type: string };
    }) => {
      const { artifactVersionId, parentArtifactVersionId } = where.artifactVersionId_parentArtifactVersionId;
      const existing = Array.from(lineageById.values()).find(
        (l) => l.artifactVersionId === artifactVersionId && l.parentArtifactVersionId === parentArtifactVersionId,
      );
      if (existing) {
        existing.type = create.type;
        return existing;
      }
      const row: FakeArtifactLineageRow = {
        id: uuidv7(),
        artifactVersionId,
        parentArtifactVersionId,
        type: create.type,
      };
      lineageById.set(row.id, row);
      return row;
    },
    deleteMany: async ({ where }: { where: { artifactVersionId: string; parentArtifactVersionId: string } }) => {
      const before = lineageById.size;
      Array.from(lineageById.values())
        .filter(
          (l) =>
            l.artifactVersionId === where.artifactVersionId &&
            l.parentArtifactVersionId === where.parentArtifactVersionId,
        )
        .forEach((l) => lineageById.delete(l.id));
      return { count: before - lineageById.size };
    },
    findMany: async ({ where, include }: { where: { artifactVersionId?: string; parentArtifactVersionId?: string }; include?: unknown } = { where: {} }) => {
      const all = Array.from(lineageById.values()).filter((l) => {
        if (where.artifactVersionId && l.artifactVersionId !== where.artifactVersionId) return false;
        if (where.parentArtifactVersionId && l.parentArtifactVersionId !== where.parentArtifactVersionId) return false;
        return true;
      });
      return all.map((l) => attachLineageIncludes(l, include));
    },
  };

  const sweepModel = {
    create: async ({ data }: { data: Partial<FakeSweepRow> }) => {
      const id = data.id ?? uuidv7();
      const row: FakeSweepRow = {
        id,
        projectId: data.projectId!,
        name: data.name!,
        method: data.method ?? "random",
        config: data.config ?? {},
        state: data.state ?? "running",
        bestRunId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sweepsById.set(id, row);
      return row;
    },
    findUnique: async ({ where, include }: { where: { id?: string }; include?: unknown }) => {
      const row = where.id ? sweepsById.get(where.id) : null;
      if (!row) return null;
      if (include) {
        const inc = include as { runs?: { orderBy?: { createdAt: "asc" | "desc" } } };
        const runs = sweepRuns
          .filter((r) => r.sweepId === row.id)
          .sort((a, b) => {
            const dir = inc.runs?.orderBy?.createdAt === "asc" ? 1 : -1;
            return dir * (a.createdAt.getTime() - b.createdAt.getTime());
          });
        return { ...row, runs };
      }
      return row;
    },
    findMany: async ({ where }: { where?: { projectId?: string } } = {}) => {
      const all = Array.from(sweepsById.values());
      const filtered = where?.projectId ? all.filter((s) => s.projectId === where.projectId) : all;
      return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<FakeSweepRow> }) => {
      const row = sweepsById.get(where.id);
      if (!row) throw new Error(`Sweep ${where.id} not found`);
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      sweepsById.delete(where.id);
      return sweepsById.get(where.id) ?? null;
    },
  };

  const runWithSweepModel = {
    insert: (row: FakeRunWithSweep) => sweepRuns.push(row),
    findBySweep: (sweepId: string) => sweepRuns.filter((r) => r.sweepId === sweepId),
  };

  function attachVersionIncludes(row: FakeArtifactVersionRow, include: unknown) {
    const result: Record<string, unknown> = { ...row };
    const inc = include as { files?: unknown; artifact?: unknown };
    if (inc?.files) {
      result.files = Array.from(filesById.values()).filter((f) => f.artifactVersionId === row.id);
    }
    if (inc?.artifact) {
      result.artifact = artifactsById.get(row.artifactId) ?? null;
    }
    return result;
  }

  function attachLineageIncludes(row: FakeArtifactLineageRow, include: unknown) {
    const result: Record<string, unknown> = { ...row };
    const inc = include as {
      parentArtifactVersion?: unknown;
      artifactVersion?: unknown;
    };
    if (inc?.parentArtifactVersion) {
      const parent = versionsById.get(row.parentArtifactVersionId);
      if (parent) {
        const enriched = attachVersionIncludes(parent, (inc.parentArtifactVersion as { include?: unknown })?.include);
        result.parentArtifactVersion = enriched;
      } else {
        result.parentArtifactVersion = null;
      }
    }
    if (inc?.artifactVersion) {
      const child = versionsById.get(row.artifactVersionId);
      if (child) {
        const enriched = attachVersionIncludes(child, (inc.artifactVersion as { include?: unknown })?.include);
        result.artifactVersion = enriched;
      } else {
        result.artifactVersion = null;
      }
    }
    return result;
  }

  // We return a cast object; only the methods above are accessed.
  const exposed = {
    run: runModel,
    workspace: workspaceModel,
    project: projectModel,
    artifact: artifactModel,
    artifactVersion: artifactVersionModel,
    artifactFile: artifactFileModel,
    artifactLineage: artifactLineageModel,
    sweep: sweepModel,
    __test: { runWithSweep: runWithSweepModel },
  };
  return exposed as unknown as PrismaClient;
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