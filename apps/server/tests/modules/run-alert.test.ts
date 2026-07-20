import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { runAlertRoutes } from "../../src/modules/run-alert/routes.js";

const RUN_ID = "0190a5b8-7c8e-7def-8000-000000000070";

describe("POST /api/v1/runs/:id/alerts (step 3.2 sender alerts)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({
        runs: [{ runId: RUN_ID, projectId: "p1", name: "exp" }],
      }),
    });
    await app.register(runAlertRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("accepts a minimal alert", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/alerts`,
      payload: { title: "Loss spiked", text: "loss > 2.0" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.runId).toBe(RUN_ID);
    expect(body.level).toBe("INFO");
    expect(body.alertId).toBeTypeOf("string");
  });

  it("accepts an alert with level + waitDuration", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/alerts`,
      payload: {
        title: "OOM",
        text: "GPU OOM at step 100",
        level: "ERROR",
        waitDuration: 60,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.level).toBe("ERROR");
  });

  it("rejects an unknown level", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/alerts`,
      payload: { title: "x", text: "y", level: "FATAL" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("rejects missing title", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/alerts`,
      payload: { text: "y" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});