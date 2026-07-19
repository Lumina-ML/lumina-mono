import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { systemMetricRoutes } from "../../src/modules/system-metric/routes.js";

const RUN_ID = "0190a5b8-7c8e-7def-8000-000000000001";

describe("system-metric module (Phase 2 E2E)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({ runs: [{ runId: RUN_ID, projectId: "p1", name: "exp" }] }),
    });
    await app.register(systemMetricRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("POST /runs/:runId/system-metrics writes to TimeSeriesStorage, not Prisma", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/system-metrics`,
      payload: {
        metrics: [
          { key: "cpu", step: 0, value: 0.42 },
          { key: "memory", step: 0, value: 1024 },
        ],
      },
    });
    expect(res.statusCode).toBe(201);

    const rows = await app.timeSeriesStorage.query("system_metric", { runId: RUN_ID, limit: 100 });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.key).sort()).toEqual(["cpu", "memory"]);
  });

  it("GET /runs/:runId/system-metrics reads from TimeSeriesStorage", async () => {
    await app.timeSeriesStorage.insertBatch("system_metric", [
      { runId: RUN_ID, projectId: "p1", key: "cpu", step: 0, value: 0.1, loggedAt: new Date() },
      { runId: RUN_ID, projectId: "p1", key: "cpu", step: 1, value: 0.2, loggedAt: new Date() },
      { runId: RUN_ID, projectId: "p1", key: "memory", step: 0, value: 512, loggedAt: new Date() },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${RUN_ID}/system-metrics?keys=cpu`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.runId).toBe(RUN_ID);
    expect(Object.keys(body.metrics)).toEqual(["cpu"]);
    expect(body.metrics.cpu).toHaveLength(2);
    expect(body.metrics.cpu[0].step).toBe(0);
    expect(body.metrics.cpu[1].step).toBe(1);
  });

  it("POST returns 404 when run does not exist", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/does-not-exist/system-metrics`,
      payload: { metrics: [{ key: "cpu", step: 0, value: 0.1 }] },
    });
    expect(res.statusCode).toBe(404);
  });

  it("roundtrip: POST then GET returns the same data", async () => {
    const payload = {
      metrics: [
        { key: "cpu", step: 0, value: 0.42 },
        { key: "cpu", step: 1, value: 0.55 },
        { key: "memory", step: 0, value: 1024 },
      ],
    };
    const post = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/system-metrics`,
      payload,
    });
    expect(post.statusCode).toBe(201);

    const get = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${RUN_ID}/system-metrics`,
    });
    expect(get.statusCode).toBe(200);
    const body = get.json();
    expect(body.metrics.cpu).toHaveLength(2);
    expect(body.metrics.cpu.map((p: { value: number }) => p.value)).toEqual([0.42, 0.55]);
    expect(body.metrics.memory).toHaveLength(1);
  });
});