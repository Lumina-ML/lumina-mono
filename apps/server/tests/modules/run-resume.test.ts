import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { runResumeRoutes } from "../../src/modules/run-resume/routes.js";

const RUN_ID = "0190a5b8-7c8e-7def-8000-000000000050";

describe("GET /api/v1/runs/:id/resume-state (step 3.2 sender resume)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({
        runs: [{ runId: RUN_ID, projectId: "p1", name: "exp" }],
      }),
    });
    await app.register(runResumeRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("returns resumable state shape with empty tails", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${RUN_ID}/resume-state`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      historyTail: [],
      eventsTail: [],
      config: {},
      summaryMetrics: {},
      historyLineCount: 0,
      eventsLineCount: 0,
      logLineCount: 0,
      tags: [],
    });
  });

  it("returns 404 for unknown run", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/runs/no-such/resume-state`,
    });
    expect(res.statusCode).toBe(404);
  });
});