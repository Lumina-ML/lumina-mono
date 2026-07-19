import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { logLineRoutes } from "../../src/modules/log-line/routes.js";

const RUN_ID = "0190a5b8-7c8e-7def-8000-000000000002";

describe("log-line module (Phase 2 E2E)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({ runs: [{ runId: RUN_ID, projectId: "p1" }] }),
    });
    await app.register(logLineRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("POST /runs/:runId/logs writes to TimeSeriesStorage", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/logs`,
      payload: {
        logs: [
          { level: "INFO", message: "starting", step: 0 },
          { level: "ERROR", message: "boom", step: 5 },
        ],
      },
    });
    expect(res.statusCode).toBe(201);

    const rows = await app.timeSeriesStorage.query("log_line", { runId: RUN_ID, limit: 100 });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.level)).toEqual(["INFO", "ERROR"]);
  });

  it("GET /runs/:runId/logs filters by level", async () => {
    await app.timeSeriesStorage.insertBatch("log_line", [
      { runId: RUN_ID, projectId: "p1", level: "INFO", message: "a", timestamp: new Date(), step: 0 },
      { runId: RUN_ID, projectId: "p1", level: "ERROR", message: "b", timestamp: new Date(), step: 1 },
      { runId: RUN_ID, projectId: "p1", level: "INFO", message: "c", timestamp: new Date(), step: 2 },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${RUN_ID}/logs?level=INFO&limit=100`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.logs).toHaveLength(2);
    expect(body.logs.map((l: { message: string }) => l.message)).toEqual(["a", "c"]);
  });

  it("POST returns 404 when run does not exist", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/nope/logs`,
      payload: { logs: [{ level: "INFO", message: "x" }] },
    });
    expect(res.statusCode).toBe(404);
  });
});