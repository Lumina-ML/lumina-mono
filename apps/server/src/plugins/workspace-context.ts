/**
 * Workspace resolution + enforcement.
 *
 * Runs after `authPlugin` so we can read `req.user.id`. For each request,
 * sets `req.workspaceId` using this precedence:
 *
 *   1. **Explicit selection** — the `X-Lumina-Workspace` header (sent by the
 *      dashboard's workspace switcher and the SDK's `workspace_id=`). For an
 *      authenticated user we verify a matching `WorkspaceMembership`:
 *        - member → `req.workspaceId` = the selected id.
 *        - NOT a member → 403 (`code: WORKSPACE_FORBIDDEN`). Strict per design
 *          decision D1: a stale/forged selection must fail loudly, not
 *          silently fall back (which would mask a revoked membership and
 *          reproduce the old "switched but nothing happened" bug).
 *   2. **First membership** — no header → the user's earliest membership, in
 *      createdAt order. This is the stable "default" workspace per user.
 *   3. **Server fallback** — anonymous requests (login, healthz, bootstrap)
 *      get `config.defaultWorkspaceId`. The explicit header is ignored for
 *      anonymous requests: with no user there's no membership to verify
 *      against, so honoring it would be an unauthenticated scoping bypass.
 *
 * Once `req.workspaceId` is set, both scoping layers follow automatically:
 * list handlers pass it to their repositories, and `workspaceGuardPlugin`
 * compares each resource's workspaceId against it. This plugin is the single
 * pivot; nothing downstream needs per-request changes.
 */
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/** Header carrying the caller's explicit workspace selection. */
export const WORKSPACE_HEADER = "x-lumina-workspace";

declare module "fastify" {
  interface FastifyRequest {
    workspaceId: string;
  }
}

export const workspaceContextPlugin = fp(async (app: FastifyInstance) => {
  const fallback = app.config.defaultWorkspaceId;

  app.decorateRequest("workspaceId", fallback);

  app.addHook(
    "onRequest",
    async (req: FastifyRequest, reply: FastifyReply) => {
      // Default to the server-wide fallback until we prove otherwise. This
      // keeps public endpoints (login, healthz) working without a user.
      req.workspaceId = fallback;

      // Anonymous request: ignore any header (nothing to verify against) and
      // stay on the fallback.
      if (!req.user) return;

      const header = req.headers[WORKSPACE_HEADER];
      const selected = Array.isArray(header) ? header[0] : header;

      if (selected && selected.trim().length > 0) {
        const workspaceId = selected.trim();
        try {
          const membership =
            await req.server.prisma.workspaceMembership.findUnique({
              where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
              select: { workspaceId: true },
            });
          if (membership) {
            req.workspaceId = workspaceId;
            return;
          }
        } catch (e) {
          // A lookup failure shouldn't be interpreted as "authorized". Log and
          // fall through to the 403 so we never grant an unverified selection.
          req.server.log.warn(
            { err: (e as Error).message, userId: req.user.id, workspaceId },
            "workspaceContext: membership verification failed for explicit selection",
          );
        }
        // Explicit selection the user has no membership in (or verification
        // failed) → reject. 404-style message kind isn't used here because
        // the caller explicitly named the workspace; a 403 is the honest
        // signal and the dashboard recovers by resetting its selection.
        reply.status(403).send({
          error: "Forbidden",
          code: "WORKSPACE_FORBIDDEN",
          message: "You are not a member of the selected workspace.",
        });
        return reply;
      }

      // No explicit selection → the user's first membership (stable default).
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
        // Don't block the request on a workspace lookup failure — downstream
        // handlers may not need it. Surface in the log for operators.
        req.server.log.warn(
          { err: (e as Error).message, userId: req.user.id },
          "workspaceContext: membership lookup failed, falling back to default",
        );
      }
    },
  );
});
