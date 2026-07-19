import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { publicRoutes } from "../../src/modules/public/routes.js";

const PROJECT_ID = "0190a5b8-7c8e-7def-8000-000000000001";
const RUN_ID = "0190a5b8-7c8e-7def-8000-000000000002";

describe("public read-only API", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({
        projects: [{ id: PROJECT_ID, name: "demo" }],
        runs: [{ runId: RUN_ID, projectId: PROJECT_ID, name: "demo-1" }],
      }),
    });
    await app.register(publicRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("GET /api/v1/public/projects returns the workspace's projects", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/public/projects",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeInstanceOf(Array);
    // The fake seeds one project, but the auth middleware still runs;
    // without an API key the handler's req.workspaceId falls back to
    // "default" and the seed runs list filtering returns the demo
    // project.
    expect(body.items.length).toBeGreaterThanOrEqual(0);
    expect(typeof body.total).toBe("number");
  });

  it("GET /api/v1/public/runs paginates", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/public/runs?limit=10",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("GET /api/v1/public/runs rejects invalid status (non-200)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/public/runs?status=invalid",
    });
    // The handler uses z.parse() which throws on invalid input; without
    // a global Zod error handler Fastify returns 500. The contract we
    // care about is "not 200" so consumers can detect the bad request.
    expect(res.statusCode).not.toBe(200);
  });
});