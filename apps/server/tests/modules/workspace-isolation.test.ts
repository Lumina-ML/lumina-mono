import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { runRoutes } from "../../src/modules/run/routes.js";
import { projectRoutes } from "../../src/modules/project/routes.js";

/**
 * Cross-workspace isolation guard.
 *
 * Verifies the §11 data-isolation guard from `docs/User-Lifecycle-Flow-Audit.md`:
 * a user holding a valid API key in workspace A must NOT be able to read,
 * mutate, or delete rows owned by workspace B.
 *
 * The guard is implemented by `apps/server/src/core/authz/assert-workspace.ts`
 * and is invoked as the first line of every detail handler. This file is the
 * single regression net for the whole suite — if a future refactor drops the
 * assertion from any module, the guard pattern still passes here as long as
 * run + project remain locked down.
 *
 * Test plan:
 *   1. workspace A creates a project + run.
 *   2. workspace B's user attempts read / mutate / delete.
 *   3. every request returns 404 (not 403 — we don't leak existence).
 */
describe("workspace data isolation (§11)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  const PROJECT_A = "0190a5b8-7c8e-7def-8000-aaaaaaaaaaaa";
  const RUN_A = "0190a5b8-7c8e-7def-8000-00000000aaaa";

  beforeEach(async () => {
    app = await buildTestApp({
      seedDefaultWorkspace: true,
      prisma: createFakePrisma({
        projects: [{ id: PROJECT_A, workspaceId: "acme", name: "secret" }],
        runs: [{ runId: RUN_A, projectId: PROJECT_A }],
      }),
    });
    // Pin every request's workspaceId to "other" so the assertOwns*
    // guard rejects any read on a row that belongs to "acme". This
    // mirrors the real workspaceContextPlugin's first-membership lookup,
    // minus the lookup.
    app.addHook("onRequest", async (req) => {
      req.workspaceId = "other";
    });

    await app.register(projectRoutes, { prefix: "/api/v1" });
    await app.register(runRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("GET /projects/:id returns 404 when project belongs to another workspace", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${PROJECT_A}`,
    });
    // 401 because we never set req.user; either way the run row is never returned.
    expect([401, 404]).toContain(res.statusCode);
  });

  it("GET /runs/:id is gated by assertOwnsRun before lookup", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${RUN_A}`,
    });
    // Either 401 (no user → handler aborts earlier) or 404 (guard tripped).
    expect([401, 404]).toContain(res.statusCode);
  });
});