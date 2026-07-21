// MUST be the first import — `reflect-metadata` polyfills
// `Reflect.metadata` for tsyringe's `@injectable()` / `@inject()` decorators
// to function at runtime. Without this, every `@inject("X")` resolves to
// `Object` instead of the registered instance.
import "reflect-metadata";
import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import fastify from "fastify";
import { ZodError } from "zod";
import { Prisma } from "./generated/prisma/index.js";
import { buildLoggerOptions, requestIdHeader } from "./core/logging/index.js";
import { configPlugin } from "./plugins/config.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { clickhousePlugin } from "./plugins/clickhouse.js";
import { storagePlugin } from "./plugins/storage.js";
import { authPlugin } from "./plugins/auth.js";
import { telemetryPlugin } from "./plugins/telemetry.js";
import { busPlugin } from "./plugins/bus.js";
import { cachePlugin } from "./plugins/cache.js";
import { queuePlugin } from "./plugins/queue.js";
import { observabilityPlugin } from "./plugins/observability.js";
import { websocketPlugin } from "./plugins/websocket.js";
import { healthPlugin } from "./plugins/health.js";
import { otelPlugin } from "./plugins/otel.js";
import { workspaceContextPlugin } from "./plugins/workspace-context.js";
import { workspaceGuardPlugin } from "./plugins/workspace-guard.js";
import { artifactRoutes } from "./modules/artifact/routes.js";
import { evaluationRoutes } from "./modules/evaluation/routes.js";
import { logLineRoutes } from "./modules/log-line/routes.js";
import { traceRoutes } from "./modules/trace/routes.js";
import { reportRoutes } from "./modules/report/routes.js";
import { runMediaRoutes } from "./modules/run-media/routes.js";
import { launchRoutes } from "./modules/launch/routes.js";
import { publicRoutes } from "./modules/public/routes.js";
import { sandboxRoutes } from "./modules/sandbox/routes.js";
import { metricRoutes } from "./modules/metric/routes.js";
import { projectRoutes } from "./modules/project/routes.js";
import { registryModelRoutes } from "./modules/registry-model/routes.js";
import { userRoutes } from "./modules/user/routes.js";
import { workspaceMembershipRoutes } from "./modules/workspace-membership/routes.js";
import { runRoutes } from "./modules/run/routes.js";
import { runFileRoutes } from "./modules/run-file/routes.js";
import { runStopRoutes } from "./modules/run-stop/routes.js";
import { runResumeRoutes } from "./modules/run-resume/routes.js";
import { runRewindRoutes } from "./modules/run-rewind/routes.js";
import { runAlertRoutes } from "./modules/run-alert/routes.js";
import { runUseArtifactRoutes } from "./modules/run-use-artifact/routes.js";
import { artifactLinkRoutes } from "./modules/artifact-link/routes.js";
import { sweepRoutes } from "./modules/sweep/routes.js";
import { systemMetricRoutes } from "./modules/system-metric/routes.js";
import { tagRoutes } from "./modules/tag/routes.js";
import { storageLocalRoutes } from "./infra/storage/routes.js";

// `defaultWorkspaceId` is read from `LUMINA_DEFAULT_WORKSPACE_ID` via
// `loadConfig()` and reused everywhere we previously hardcoded "default".
// See `apps/server/src/config/index.ts`.

export async function buildApp() {
  // Honor a client-supplied request id header (falling back to a fresh
  // UUID) at `genReqId` time so Fastify binds it onto `req.id` *and* the
  // per-request child logger (`req.log`) — every downstream log line is
  // then tagged with the same reqId without any manual plumbing. The
  // observability plugin mirrors it onto `req.reqId` for otel/spans.
  const reqIdHeader = requestIdHeader();
  const app = fastify({
    logger: buildLoggerOptions({ name: "lumina-server" }),
    genReqId: (req) => {
      const fromHeader = req.headers[reqIdHeader];
      if (typeof fromHeader === "string" && fromHeader.length > 0) {
        return fromHeader;
      }
      return randomUUID();
    },
    // The observability plugin logs a single structured "request completed"
    // line (with metrics) per request. Fastify's built-in "incoming
    // request" / "request completed" pair would double every request, so
    // disable it and keep our one canonical line.
    disableRequestLogging: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Convert Zod validation failures into structured 400s instead of
  // Fastify's default 500. Every handler calls `SomeSchema.parse(...)`
  // on its inputs; without this hook a typo in the request body leaks
  // as a generic "Internal Server Error" to clients, which is
  // indistinguishable from a real server bug. This makes the contract
  // explicit: invalid input → 400 with field-level issues.
  //
  // Also map Prisma's P2002 (unique constraint) to 409 so that a
  // duplicate-signup or duplicate-artifact returns "Conflict" instead
  // of leaking as 500. Without this, every handler would need its own
  // catch block (user.ts already has one for its own P2002 — leave it,
  // it just becomes a no-op fast-path).
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      reply.status(400).send({
        error: "ValidationError",
        message: "Request body or params failed schema validation.",
        issues: err.issues.map((i) => ({
          path: i.path.join("."),
          code: i.code,
          message: i.message,
        })),
      });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined) ?? [];
      const field = target[0] ?? "field";
      reply.status(409).send({
        error: "Conflict",
        message: `A record with this ${field} already exists.`,
        field,
      });
      return;
    }
    reply.send(err);
  });

  // 1. Configuration
  await app.register(configPlugin);

  // 2. Core infrastructure
  await app.register(prismaPlugin);
  await app.register(clickhousePlugin);
  await app.register(storagePlugin);
  await app.register(telemetryPlugin);
  await app.register(busPlugin);
  await app.register(cachePlugin);
  await app.register(queuePlugin);

  // 3. Cross-cutting concerns
  // Observability must come before OTel so the request id is set on
  // every request — the otel plugin uses it as a span attribute.
  await app.register(authPlugin);
  await app.register(observabilityPlugin);
  await app.register(otelPlugin);
  // Workspace context runs after auth so it can read req.user.id and
  // resolve the user's default workspace from their memberships.
  await app.register(workspaceContextPlugin);
  // Workspace guard enforces route-level `config.authz` rules. Runs as a
  // preHandler hook so it sits after auth (req.user) and workspace
  // context (req.workspaceId) have been resolved but before the handler
  // touches any data. Without this hook, the per-handler `assertOwns*`
  // ceremony still works; this plugin is the new policy surface.
  await app.register(workspaceGuardPlugin);
  await app.register(websocketPlugin);
  // Health endpoints are unauthenticated and live outside /api/v1 so
  // orchestrators can probe them without an API key.
  await app.register(healthPlugin);

  // 4. Business modules
  await app.register(userRoutes, { prefix: "/api/v1" });
  await app.register(workspaceMembershipRoutes, { prefix: "/api/v1" });
  await app.register(projectRoutes, { prefix: "/api/v1" });
  await app.register(runRoutes, { prefix: "/api/v1" });
  await app.register(runStopRoutes, { prefix: "/api/v1" });
  await app.register(runResumeRoutes, { prefix: "/api/v1" });
  await app.register(runRewindRoutes, { prefix: "/api/v1" });
  await app.register(runAlertRoutes, { prefix: "/api/v1" });
  await app.register(runUseArtifactRoutes, { prefix: "/api/v1" });
  await app.register(artifactLinkRoutes, { prefix: "/api/v1" });
  await app.register(runFileRoutes, { prefix: "/api/v1" });
  await app.register(metricRoutes, { prefix: "/api/v1" });
  await app.register(systemMetricRoutes, { prefix: "/api/v1" });
  await app.register(logLineRoutes, { prefix: "/api/v1" });
  await app.register(tagRoutes, { prefix: "/api/v1" });
  await app.register(sweepRoutes, { prefix: "/api/v1" });
  await app.register(artifactRoutes, { prefix: "/api/v1" });
  await app.register(registryModelRoutes, { prefix: "/api/v1" });
  await app.register(evaluationRoutes, { prefix: "/api/v1" });
  await app.register(traceRoutes, { prefix: "/api/v1" });
  await app.register(reportRoutes, { prefix: "/api/v1" });
  await app.register(runMediaRoutes, { prefix: "/api/v1" });
  await app.register(launchRoutes, { prefix: "/api/v1" });
  await app.register(storageLocalRoutes, { prefix: "/api/v1" });
  // Public read-only API used by `lumina.PublicApi`. Authenticated like
  // the rest of /api/v1 but bypasses the internal handlers so the shape
  // stays stable for external consumers.
  await app.register(publicRoutes, { prefix: "/api/v1" });
  // Sandbox endpoints back the dashboard's "Try it" demo cards
  // (Roadmap §MVP-2 / M1-1). Authenticated like the rest of /api/v1;
  // does not require a project in the URL — the demo project is resolved
  // by name inside the active workspace.
  await app.register(sandboxRoutes, { prefix: "/api/v1" });

  // 5. Default workspace seed. Single-tenant deployments keep the
  // workspace id pinned via `LUMINA_DEFAULT_WORKSPACE_ID` (default
  // "default"); the seed idempotently ensures it exists so the first
  // user can be attached without the caller having to pre-create it.
  const defaultWorkspaceId = app.config.defaultWorkspaceId;
  await app.prisma.workspace.upsert({
    where: { id: defaultWorkspaceId },
    create: {
      id: defaultWorkspaceId,
      name: defaultWorkspaceId,
      displayName: "Default Workspace",
    },
    update: {},
  });

  // 6. Demo project seed. Always ensure the `__demo__` project exists
  // in the default workspace so the dashboard's "Try it" cards have a
  // stable target and new users land on something other than a blank
  // page. See `apps/server/src/core/seed/demo-seed.ts`. Errors here are
  // logged but non-fatal — a freshly-installed DB with permission
  // issues shouldn't prevent the server from starting.
  try {
    const { ensureDemoProject } = await import("./core/seed/demo-seed.js");
    const seeded = await ensureDemoProject(app.prisma, defaultWorkspaceId);
    if (seeded.created) {
      app.log.info(
        { projectId: seeded.projectId },
        "Seeded __demo__ project in default workspace",
      );
    }
  } catch (err) {
    app.log.warn({ err }, "Demo project seed failed; continuing without it");
  }

  return app;
}
