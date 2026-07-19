import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { metricRoutes } from "../../src/modules/metric/routes.js";

const RUN_ID = "0190a5b8-7c8e-7def-8000-000000000003";

describe("metric module (Phase 2 E2E baseline)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({ runs: [{ runId: RUN_ID, projectId: "p1" }] }),
    });
    await app.register(metricRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("POST + GET roundtrip through MetricStorage abstraction", async () => {
    const post = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/metrics`,
      payload: {
        metrics: [
          { key: "loss", step: 0, value: 0.9 },
          { key: "loss", step: 1, value: 0.5 },
          { key: "acc", step: 0, value: 0.1 },
        ],
      },
    });
    expect(post.statusCode).toBe(201);

    const get = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${RUN_ID}/metrics`,
    });
    expect(get.statusCode).toBe(200);
    const body = get.json();
    expect(Object.keys(body.metrics).sort()).toEqual(["acc", "loss"]);
    expect(body.metrics.loss.map((p: { value: number }) => p.value)).toEqual([0.9, 0.5]);
  });

  it("publishes MetricLogged event with the right keys/count", async () => {
    const seen: Array<{ keys: string[]; count: number }> = [];
    app.eventBus.subscribe("MetricLogged", (event) => {
      seen.push(event.payload);
    });

    await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/metrics`,
      payload: {
        metrics: [
          { key: "loss", step: 0, value: 0.9 },
          { key: "acc", step: 0, value: 0.1 },
        ],
      },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ runId: RUN_ID, keys: ["loss", "acc"], count: 2 });
  });

  // SDK-Server-FE Gap doc item #14: ListMetricsQuery.keys widens to accept
  // both ?keys=a,b,c (comma-separated) and ?keys=a&keys=b (repeated).
  // Regression-locks both shapes — touches metric/handler.ts and
  // metric/schema.ts.
  it("GET /runs/:runId/metrics accepts ?keys=a,b,c and ?keys=a&keys=b", async () => {
    await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/metrics`,
      payload: {
        metrics: [
          { key: "loss", step: 0, value: 0.9 },
          { key: "loss", step: 1, value: 0.5 },
          { key: "acc", step: 0, value: 0.1 },
        ],
      },
    });

    const comma = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${RUN_ID}/metrics?keys=loss,acc`,
    });
    expect(comma.statusCode).toBe(200);
    const commaBody = comma.json();
    expect(Object.keys(commaBody.metrics).sort()).toEqual(["acc", "loss"]);

    const repeated = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${RUN_ID}/metrics?keys=loss&keys=acc`,
    });
    expect(repeated.statusCode).toBe(200);
    const repeatedBody = repeated.json();
    expect(Object.keys(repeatedBody.metrics).sort()).toEqual(["acc", "loss"]);
  });
});