import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { runRewindRoutes } from "../../src/modules/run-rewind/routes.js";

const RUN_ID = "0190a5b8-7c8e-7def-8000-000000000060";

describe("POST /api/v1/runs/:id/rewind (step 3.2 sender rewind)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({
        runs: [{ runId: RUN_ID, projectId: "p1", name: "exp" }],
      }),
    });
    await app.register(runRewindRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("returns resume-state shape on rewind", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/rewind`,
      payload: { metricName: "best_loss", metricValue: 0.1 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      historyTail: [],
      eventsTail: [],
      historyLineCount: 0,
      eventsLineCount: 0,
    });
  });

  it("rejects payload missing metricName", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/rewind`,
      payload: { metricValue: 0.1 },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("returns 404 for unknown run", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/no-such/rewind`,
      payload: { metricName: "loss", metricValue: 0.5 },
    });
    expect(res.statusCode).toBe(404);
  });
});