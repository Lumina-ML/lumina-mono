/**
 * Workspace-ownership enforcement hook.
 *
 * Replaces the per-handler `assertOwns*(...)` ceremony with a single
 * preHandler hook that reads `req.routeOptions.config.authz` and looks
 * up the row's workspaceId. Mismatches 404.
 *
 * Routes opt in by setting `config: { authz: ... }` in their route
 * definition. The rule names a resource kind and the param name on
 * `req.params` that holds the resource id. Multi-id routes can pass
 * an array of rules — all must match (or the request 404s on the
 * first mismatch).
 *
 *   fastify.get("/runs/:runId", {
 *     config: { authz: { kind: "run", param: "runId" } },
 *     schema: { ... },
 *   }, handler.getById);
 *
 *   fastify.delete("/versions/:versionId/lineage/:parentVersionId", {
 *     config: { authz: [
 *       { kind: "artifactVersion", param: "versionId" },
 *       { kind: "artifactVersion", param: "parentVersionId" },
 *     ] },
 *   }, handler.detachLineage);
 *
 * The hook runs regardless of `req.user` so it preserves today's
 * behavior exactly: anonymous single-tenant traffic (where the row's
 * workspaceId equals the fallback `defaultWorkspaceId`) still 200s;
 * cross-workspace attempts still 404. Auth enforcement is a separate
 * follow-up.
 *
 * Resources whose id lives in `req.body` (artifacts.attachLineage,
 * tags.attachToRun) still call `assertOwns*(...)` inline — those
 * cases can't be expressed as a route config rule.
 */
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "../generated/prisma/index.js";
import {
  lookupArtifact,
  lookupArtifactVersion,
  lookupEvaluation,
  lookupLaunchJob,
  lookupLaunchQueue,
  lookupLaunchRun,
  lookupProject,
  lookupRegistryModel,
  lookupRegistryModelVersion,
  lookupReport,
  lookupRun,
  lookupRunMedia,
  lookupSpan,
  lookupSweep,
  lookupTag,
  lookupTrace,
} from "../core/authz/assert-workspace.js";

export type AuthzRule =
  | { kind: "project"; param: string }
  | { kind: "run"; param: string }
  | { kind: "artifact"; param: string }
  | { kind: "artifactVersion"; param: string }
  | { kind: "registryModel"; param: string }
  | { kind: "registryModelVersion"; param: string }
  | { kind: "evaluation"; param: string }
  | { kind: "trace"; param: string }
  | { kind: "span"; param: string }
  | { kind: "report"; param: string }
  | { kind: "runMedia"; param: string }
  | { kind: "sweep"; param: string }
  | { kind: "launchQueue"; param: string }
  | { kind: "launchJob"; param: string }
  | { kind: "launchRun"; param: string }
  | { kind: "tag"; param: string };

declare module "fastify" {
  interface FastifyContextConfig {
    /**
     * Optional ownership rule(s) applied by `workspaceGuardPlugin`.
     * A single rule covers routes with one resource id; pass an array
     * for routes that need to validate two (e.g. a lineage edge).
     */
    authz?: AuthzRule | AuthzRule[];
  }
}

const NOT_FOUND: Record<AuthzRule["kind"], string> = {
  project: "Project not found",
  run: "Run not found",
  artifact: "Artifact not found",
  artifactVersion: "Artifact version not found",
  registryModel: "Registry model not found",
  registryModelVersion: "Registry model version not found",
  evaluation: "Evaluation not found",
  trace: "Trace not found",
  span: "Span not found",
  report: "Report not found",
  runMedia: "Run media not found",
  sweep: "Sweep not found",
  launchQueue: "Launch queue not found",
  launchJob: "Launch job not found",
  launchRun: "Launch run not found",
  tag: "Tag not found",
};

async function lookup(
  prisma: PrismaClient,
  rule: AuthzRule,
  id: string,
): Promise<string | null> {
  switch (rule.kind) {
    case "project":
      return lookupProject(prisma, id);
    case "run":
      return lookupRun(prisma, id);
    case "artifact":
      return lookupArtifact(prisma, id);
    case "artifactVersion":
      return lookupArtifactVersion(prisma, id);
    case "registryModel":
      return lookupRegistryModel(prisma, id);
    case "registryModelVersion":
      return lookupRegistryModelVersion(prisma, id);
    case "evaluation":
      return lookupEvaluation(prisma, id);
    case "trace":
      return lookupTrace(prisma, id);
    case "span":
      return lookupSpan(prisma, id);
    case "report":
      return lookupReport(prisma, id);
    case "runMedia":
      return lookupRunMedia(prisma, id);
    case "sweep":
      return lookupSweep(prisma, id);
    case "launchQueue":
      return lookupLaunchQueue(prisma, id);
    case "launchJob":
      return lookupLaunchJob(prisma, id);
    case "launchRun":
      return lookupLaunchRun(prisma, id);
    case "tag":
      return lookupTag(prisma, id);
  }
}

export const workspaceGuardPlugin = fp(async (app: FastifyInstance) => {
  app.addHook(
    "preHandler",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const cfg = req.routeOptions.config?.authz;
      if (!cfg) return; // No rule → unguarded.

      const rules = Array.isArray(cfg) ? cfg : [cfg];
      const params = req.params as Record<string, string | undefined>;

      for (const rule of rules) {
        const id = params[rule.param];
        // Param missing → let the handler's zod schema return its own
        // 400 with the validation envelope. Don't 404 here because the
        // handler may legitimately accept a request where the param is
        // optional (rare today; safer than inventing a 400 shape).
        if (!id) return;

        const rowWorkspaceId = await lookup(req.server.prisma, rule, id);
        if (rowWorkspaceId !== req.workspaceId) {
          reply.status(404).send({ error: NOT_FOUND[rule.kind] });
          return reply;
        }
      }
    },
  );
});