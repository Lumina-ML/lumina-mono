/**
 * Workspace resolution.
 *
 * Runs after `authPlugin` so we can read `req.user.id`. For each
 * request, sets `req.workspaceId` to:
 *
 *   1. The user's first workspace membership, in createdAt order — this
 *      is the stable "default" workspace for the user.
 *   2. The server's configured `defaultWorkspaceId` (env:
 *      `LUMINA_DEFAULT_WORKSPACE_ID`) when the request is anonymous.
 *
 * Handlers can opt out of the user lookup (e.g. listing workspaces
 * themselves) by reading `req.user` and bypassing `req.workspaceId`
 * entirely.
 *
 * Note: this plugin does not ENFORCE workspace scoping — that's a
 * separate hardening pass that needs to flow `req.workspaceId` into
 * every repository call. Today's release ships the resolver; the
 * enforcement is a follow-up that touches every module's repository.
 */
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    workspaceId: string;
  }
}

export const workspaceContextPlugin = fp(async (app: FastifyInstance) => {
  const fallback = app.config.defaultWorkspaceId;

  // Cache the membership lookup for the lifetime of the request so we
  // don't re-query Prisma on every downstream handler in the chain.
  app.decorateRequest("workspaceId", fallback);

  app.addHook(
    "onRequest",
    async (req: FastifyRequest, _reply: FastifyReply) => {
      // Default to the server-wide fallback until we prove the user has
      // a membership. This keeps public endpoints (login, healthz)
      // working without a user record.
      req.workspaceId = fallback;

      if (!req.user) return;

      try {
        const membership = await req.server.prisma.workspaceMembership.findFirst(
          {
            where: { userId: req.user.id },
            orderBy: { createdAt: "asc" },
            select: { workspaceId: true },
          },
        );
        if (membership?.workspaceId) {
          req.workspaceId = membership.workspaceId;
        }
      } catch (e) {
        // Don't block the request on a workspace lookup failure — the
        // downstream handlers may not need it. Surface in the log so
        // operators can see the underlying problem.
        req.server.log.warn(
          { err: (e as Error).message, userId: req.user.id },
          "workspaceContext: membership lookup failed, falling back to default",
        );
      }
    },
  );
});