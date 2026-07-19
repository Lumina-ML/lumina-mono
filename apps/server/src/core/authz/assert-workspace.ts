import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "../../generated/prisma/index.js";

/**
 * Workspace-ownership guards for resource handlers.
 *
 * Each helper resolves a row's parent workspace and 404s if it doesn't
 * match `req.workspaceId`. We deliberately use 404 (not 403) so a user
 * in workspace A can't enumerate which IDs exist in workspace B by
 * distinguishing 403 from 404.
 *
 * Call these as the FIRST line in a detail handler. They mutate `reply`
 * and return `boolean` for an `if (!assertOwns...(...)) return;` style,
 * mirroring the existing `requireAuth(req, reply)` pattern in
 * `apps/server/src/plugins/auth.ts`.
 */
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
  // Touch prisma so callers don't need to import it just to silence
  // unused-var; also lets tests inject a fake via the app decorator.
  void prisma;
  return true;
}

/** Authorize a projectId route. Use when the URL is `/projects/:projectId/...`. */
export async function assertOwnsProject(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  projectId: string,
): Promise<boolean> {
  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.workspaceId,
    "Project not found",
  );
}

/**
 * Authorize a runId route. The Run → Project → Workspace chain is one
 * indexed hop via the existing `runId @unique` index plus the FK.
 */
export async function assertOwnsRun(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  runId: string,
): Promise<boolean> {
  const row = await prisma.run.findUnique({
    where: { runId },
    select: { project: { select: { workspaceId: true } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.project.workspaceId,
    "Run not found",
  );
}

/** Authorize a runId route for child tables that denormalise projectId. */
export async function assertOwnsRunChild(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  args: {
    runId: string;
    child: "metric" | "systemMetric" | "logLine";
    notFoundMessage: string;
  },
): Promise<boolean> {
  // The metric / systemMetric / logLine tables all store `projectId`
  // directly, so we can check the run's workspace in one hop without
  // joining through the run row.
  const row = await prisma.run.findUnique({
    where: { runId: args.runId },
    select: { project: { select: { workspaceId: true } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.project.workspaceId,
    args.notFoundMessage,
  );
}

/** Authorize an artifact detail route by artifactId. */
export async function assertOwnsArtifact(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  artifactId: string,
): Promise<boolean> {
  const row = await prisma.artifact.findUnique({
    where: { id: artifactId },
    select: { project: { select: { workspaceId: true } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.project.workspaceId,
    "Artifact not found",
  );
}

/** Authorize an artifactVersionId route (artifact/lineage endpoints). */
export async function assertOwnsArtifactVersion(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  versionId: string,
): Promise<boolean> {
  const row = await prisma.artifactVersion.findUnique({
    where: { id: versionId },
    select: { artifact: { select: { project: { select: { workspaceId: true } } } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.artifact.project.workspaceId,
    "Artifact version not found",
  );
}

/** Authorize a registryModelId route. */
export async function assertOwnsRegistryModel(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  modelId: string,
): Promise<boolean> {
  const row = await prisma.registryModel.findUnique({
    where: { id: modelId },
    select: { project: { select: { workspaceId: true } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.project.workspaceId,
    "Registry model not found",
  );
}

/** Authorize a registryModelVersionId route. */
export async function assertOwnsRegistryModelVersion(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  versionId: string,
): Promise<boolean> {
  const row = await prisma.registryModelVersion.findUnique({
    where: { id: versionId },
    select: { registryModel: { select: { project: { select: { workspaceId: true } } } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.registryModel.project.workspaceId,
    "Registry model version not found",
  );
}

/** Authorize an evaluationId route. */
export async function assertOwnsEvaluation(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  evaluationId: string,
): Promise<boolean> {
  const row = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    select: { project: { select: { workspaceId: true } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.project.workspaceId,
    "Evaluation not found",
  );
}

/** Authorize a traceId route. */
export async function assertOwnsTrace(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  traceId: string,
): Promise<boolean> {
  const row = await prisma.trace.findUnique({
    where: { traceId },
    select: { project: { select: { workspaceId: true } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.project.workspaceId,
    "Trace not found",
  );
}

/** Authorize a spanId route (joins through trace → project). */
export async function assertOwnsSpan(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  spanId: string,
): Promise<boolean> {
  const row = await prisma.span.findUnique({
    where: { spanId },
    select: { trace: { select: { project: { select: { workspaceId: true } } } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.trace.project.workspaceId,
    "Span not found",
  );
}

/** Authorize a reportId route. */
export async function assertOwnsReport(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  reportId: string,
): Promise<boolean> {
  const row = await prisma.report.findUnique({
    where: { id: reportId },
    select: { project: { select: { workspaceId: true } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.project.workspaceId,
    "Report not found",
  );
}

/** Authorize a runMediaId route. */
export async function assertOwnsRunMedia(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  runMediaId: string,
): Promise<boolean> {
  const row = await prisma.runMedia.findUnique({
    where: { id: runMediaId },
    select: { project: { select: { workspaceId: true } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.project.workspaceId,
    "Run media not found",
  );
}

/** Authorize a sweepId route. */
export async function assertOwnsSweep(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  sweepId: string,
): Promise<boolean> {
  const row = await prisma.sweep.findUnique({
    where: { id: sweepId },
    select: { project: { select: { workspaceId: true } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.project.workspaceId,
    "Sweep not found",
  );
}

/**
 * Authorize a launchQueueId / launchJobId / launchRunId route. All three
 * routes hang off a single project, so they share this helper.
 */
export async function assertOwnsLaunchQueue(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  queueId: string,
): Promise<boolean> {
  const row = await prisma.launchQueue.findUnique({
    where: { id: queueId },
    select: { project: { select: { workspaceId: true } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.project.workspaceId,
    "Launch queue not found",
  );
}

export async function assertOwnsLaunchJob(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  jobId: string,
): Promise<boolean> {
  const row = await prisma.launchJob.findUnique({
    where: { id: jobId },
    select: { project: { select: { workspaceId: true } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.project.workspaceId,
    "Launch job not found",
  );
}

export async function assertOwnsLaunchRun(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  runId: string,
): Promise<boolean> {
  const row = await prisma.launchRun.findUnique({
    where: { id: runId },
    select: { queue: { select: { project: { select: { workspaceId: true } } } } },
  });
  return checkWorkspace(
    prisma,
    req,
    reply,
    row?.queue.project.workspaceId,
    "Launch run not found",
  );
}

/**
 * Authorize a tag detail route by tagId. Tags live on projects (for
 * project-wide tags) or get attached to runs (for run-scoped tags);
 * both share `projectId` on the tag row itself.
 */
export async function assertOwnsTag(
  prisma: PrismaClient,
  req: FastifyRequest,
  reply: FastifyReply,
  tagId: string,
): Promise<boolean> {
  const row = await prisma.tag.findUnique({
    where: { id: tagId },
    select: { projectId: true },
  });
  if (!row) {
    reply.status(404).send({ error: "Tag not found" });
    return false;
  }
  return assertOwnsProject(prisma, req, reply, row.projectId);
}