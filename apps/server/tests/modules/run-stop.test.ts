import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { runStopRoutes } from "../../src/modules/run-stop/routes.js";

const RUN_ID = "0190a5b8-7c8e-7def-8000-000000000040";

describe("GET /api/v1/runs/:id/should-stop (step 3.2 sender polling)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({
        runs: [{ runId: RUN_ID, projectId: "p1", name: "exp" }],
      }),
    });
    await app.register(runStopRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("returns shouldStop=false by default", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${RUN_ID}/should-stop`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ shouldStop: false });
  });

  it("returns 404 for an unknown run", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/runs/no-such-run/should-stop`,
    });
    expect(res.statusCode).toBe(404);
  });
});