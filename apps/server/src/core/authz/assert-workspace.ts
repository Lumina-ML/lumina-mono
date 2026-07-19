import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "../../generated/prisma/index.js";

/**
 * Workspace-ownership guards for resource handlers.
 *
 * Two layers, kept in one module so the lookup logic is the single
 * source of truth:
 *
 *   1. **`lookup*(prisma, id): Promise<string | null>`** — the raw
 *      Prisma query that returns the row's `workspaceId` (or `null`
 *      when the row doesn't exist). The `workspaceGuardPlugin`
 *      preHandler hook reads these for URL-param-driven authorization
 *      via `config.authz` on each route.
 *
 *   2. **`assertOwns*(prisma, req, reply, id)`** — thin wrappers that
 *      call `lookup*` and 404 if the result doesn't match
 *      `req.workspaceId`. Still used inline for the two cases the route
 *      config can't express: body-derived IDs in
 *      `artifact.attachLineage` and `tag.attachToRun`. New handlers
 *      should set `config.authz` on the route and let the preHandler
 *      hook do the work.
 *
 * Both layers deliberately use 404 (not 403) so a user in workspace A
 * can't enumerate which IDs exist in workspace B by distinguishing 403
 * from 404.
 */

/** Look up a project's workspaceId. Returns null if the row is missing. */
export async function lookupProject(
  prisma: PrismaClient,
  projectId: string,
): Promise<string | null> {
  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  return row?.workspaceId ?? null;
}

/** Look up a run's workspaceId via Run → Project → Workspace. */
export async function lookupRun(
  prisma: PrismaClient,
  runId: string,
): Promise<string | null> {
  const row = await prisma.run.findUnique({
    where: { runId },
    select: { project: { select: { workspaceId: true } } },
  });
  return row?.project.workspaceId ?? null;
}

/** Look up an artifact's workspaceId via Artifact → Project → Workspace. */
export async function lookupArtifact(
  prisma: PrismaClient,
  artifactId: string,
): Promise<string | null> {
  const row = await prisma.artifact.findUnique({
    where: { id: artifactId },
    select: { project: { select: { workspaceId: true } } },
  });
  return row?.project.workspaceId ?? null;
}

/** Look up an artifact version's workspaceId. */
export async function lookupArtifactVersion(
  prisma: PrismaClient,
  versionId: string,
): Promise<string | null> {
  const row = await prisma.artifactVersion.findUnique({
    where: { id: versionId },
    select: { artifact: { select: { project: { select: { workspaceId: true } } } } },
  });
  return row?.artifact.project.workspaceId ?? null;
}

/** Look up a registry model's workspaceId. */
export async function lookupRegistryModel(
  prisma: PrismaClient,
  modelId: string,
): Promise<string | null> {
  const row = await prisma.registryModel.findUnique({
    where: { id: modelId },
    select: { project: { select: { workspaceId: true } } },
  });
  return row?.project.workspaceId ?? null;
}

/** Look up a registry model version's workspaceId. */
export async function lookupRegistryModelVersion(
  prisma: PrismaClient,
  versionId: string,
): Promise<string | null> {
  const row = await prisma.registryModelVersion.findUnique({
    where: { id: versionId },
    select: { registryModel: { select: { project: { select: { workspaceId: true } } } } },
  });
  return row?.registryModel.project.workspaceId ?? null;
}

/** Look up an evaluation's workspaceId. */
export async function lookupEvaluation(
  prisma: PrismaClient,
  evaluationId: string,
): Promise<string | null> {
  const row = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    select: { project: { select: { workspaceId: true } } },
  });
  return row?.project.workspaceId ?? null;
}

/** Look up a trace's workspaceId. */
export async function lookupTrace(
  prisma: PrismaClient,
  traceId: string,
): Promise<string | null> {
  const row = await prisma.trace.findUnique({
    where: { traceId },
    select: { project: { select: { workspaceId: true } } },
  });
  return row?.project.workspaceId ?? null;
}

/** Look up a span's workspaceId via Span → Trace → Project → Workspace. */
export async function lookupSpan(
  prisma: PrismaClient,
  spanId: string,
): Promise<string | null> {
  const row = await prisma.span.findUnique({
    where: { spanId },
    select: { trace: { select: { project: { select: { workspaceId: true } } } } },
  });
  return row?.trace.project.workspaceId ?? null;
}

/** Look up a report's workspaceId. */
export async function lookupReport(
  prisma: PrismaClient,
  reportId: string,
): Promise<string | null> {
  const row = await prisma.report.findUnique({
    where: { id: reportId },
    select: { project: { select: { workspaceId: true } } },
  });
  return row?.project.workspaceId ?? null;
}

/** Look up a run-media row's workspaceId. */
export async function lookupRunMedia(
  prisma: PrismaClient,
  runMediaId: string,
): Promise<string | null> {
  const row = await prisma.runMedia.findUnique({
    where: { id: runMediaId },
    select: { project: { select: { workspaceId: true } } },
  });
  return row?.project.workspaceId ?? null;
}

/** Look up a sweep's workspaceId. */
export async function lookupSweep(
  prisma: PrismaClient,
  sweepId: string,
): Promise<string | null> {
  const row = await prisma.sweep.findUnique({
    where: { id: sweepId },
    select: { project: { select: { workspaceId: true } } },
  });
  return row?.project.workspaceId ?? null;
}

/** Look up a launch queue's workspaceId via LaunchQueue → Project. */
export async function lookupLaunchQueue(
  prisma: PrismaClient,
  queueId: string,
): Promise<string | null> {
  const row = await prisma.launchQueue.findUnique({
    where: { id: queueId },
    select: { project: { select: { workspaceId: true } } },
  });
  return row?.project.workspaceId ?? null;
}

/** Look up a launch job's workspaceId via LaunchJob → Project. */
export async function lookupLaunchJob(
  prisma: PrismaClient,
  jobId: string,
): Promise<string | null> {
  const row = await prisma.launchJob.findUnique({
    where: { id: jobId },
    select: { project: { select: { workspaceId: true } } },
  });
  return row?.project.workspaceId ?? null;
}

/** Look up a launch run's workspaceId via LaunchRun → Queue → Project. */
export async function lookupLaunchRun(
  prisma: PrismaClient,
  runId: string,
): Promise<string | null> {
  const row = await prisma.launchRun.findUnique({
    where: { id: runId },
    select: { queue: { select: { project: { select: { workspaceId: true } } } } },
  });
  return row?.queue.project.workspaceId ?? null;
}

/** Look up a tag's projectId (then project workspaceId). */
export async function lookupTag(
  prisma: PrismaClient,
  tagId: string,
): Promise<string | null> {
  const row = await prisma.tag.findUnique({
    where: { id: tagId },
    select: { projectId: true },
  });
  if (!row) return null;
  return lookupProject(prisma, row.projectId);
}

// ── Inline wrappers (body-derived cases only) ──────────────────────────
//
// Kept for the two cases that read IDs from `req.body`:
// `attachLineage` (artifact/handler.ts) and `attachToRun` (tag/handler.ts).
// New handlers should NOT call these for URL-param IDs — set
// `config.authz` on the route and the preHandler hook does the work.

async function checkWorkspace(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  expectedWorkspaceId: string | null | undefined,
  notFoundMessage: string,
): Promise<boolean> {
  if (!expectedWorkspaceId || expectedWorkspaceId !== req.workspaceId) {
    reply.status(404).send({ error: notFoundMessage });
    return false;
  }
  void prisma;
  return true;
}

export async function assertOwnsArtifactVersion(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  versionId: string,
): Promise<boolean> {
  return checkWorkspace(
    prisma,
    req,
    reply,
    await lookupArtifactVersion(prisma, versionId),
    "Artifact version not found",
  );
}

export async function assertOwnsTag(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  tagId: string,
): Promise<boolean> {
  return checkWorkspace(
    prisma,
    req,
    reply,
    await lookupTag(prisma, tagId),
    "Tag not found",
  );
}