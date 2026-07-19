import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { sweepRoutes } from "../../src/modules/sweep/routes.js";
import { uuidv7 } from "../../src/shared/uuid7.js";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const SWEEP_ID = uuidv7();

describe("sweep module (Bayesian + observations + early terminate)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let prisma: ReturnType<typeof createFakePrisma>;

  beforeEach(async () => {
    prisma = createFakePrisma({
      projects: [{ id: PROJECT_ID, name: "demo" }],
      sweeps: [
        {
          id: SWEEP_ID,
          projectId: PROJECT_ID,
          name: "lr-sweep",
          method: "bayes",
          config: {
            parameters: {
              lr: { min: 1e-4, max: 1e-1, distribution: "log_uniform" },
              batch_size: { values: [16, 32, 64, 128] },
            },
            metric: { name: "val_loss", goal: "minimize" },
            early_terminate: { type: "median", min_iter: 1 },
          },
        },
      ],
    });
    app = await buildTestApp({ prisma });
    await app.register(sweepRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  function seedRuns(samples: Array<{ runId: string; params: Record<string, unknown>; metric: number | null }>) {
    const testPrisma = prisma as unknown as {
      __test: {
        runWithSweep: { insert: (row: unknown) => void };
      };
    };
    for (const s of samples) {
      testPrisma.__test.runWithSweep.insert({
        id: uuidv7(),
        runId: s.runId,
        sweepId: SWEEP_ID,
        config: s.params,
        summary: s.metric === null ? {} : { val_loss: s.metric },
        status: "finished",
        createdAt: new Date(),
      });
    }
  }

  it("GET /sweeps/:id/observations returns (params, metric) per past run", async () => {
    seedRuns([
      { runId: uuidv7(), params: { lr: 0.001, batch_size: 32 }, metric: 0.4 },
      { runId: uuidv7(), params: { lr: 0.01, batch_size: 64 }, metric: 0.2 },
    ]);

    const res = await app.inject({ method: "GET", url: `/api/v1/sweeps/${SWEEP_ID}/observations` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({
      params: { lr: 0.001, batch_size: 32 },
      metric: 0.4,
      status: "finished",
    });
  });

  it("POST /sweeps/:id/suggest falls back to LHS when <3 observations", async () => {
    seedRuns([{ runId: uuidv7(), params: { lr: 0.005, batch_size: 32 }, metric: 0.5 }]);
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sweeps/${SWEEP_ID}/suggest`,
      payload: { count: 3 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().candidates).toHaveLength(3);
  });

  it("POST /sweeps/:id/suggest uses Gaussian Process + EI when >=3 observations", async () => {
    seedRuns([
      { runId: uuidv7(), params: { lr: 0.0001, batch_size: 16 }, metric: 0.9 },
      { runId: uuidv7(), params: { lr: 0.001, batch_size: 32 }, metric: 0.5 },
      { runId: uuidv7(), params: { lr: 0.01, batch_size: 64 }, metric: 0.2 },
      { runId: uuidv7(), params: { lr: 0.1, batch_size: 128 }, metric: 0.8 },
    ]);
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sweeps/${SWEEP_ID}/suggest`,
      payload: { count: 1 },
    });
    expect(res.statusCode).toBe(200);
    const candidates = res.json().candidates as Array<Record<string, unknown>>;
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toHaveProperty("lr");
    expect(candidates[0]).toHaveProperty("batch_size");
  });

  it("POST /sweeps/:id/should-terminate stops underperforming runs (median)", async () => {
    seedRuns([
      { runId: uuidv7(), params: { lr: 0.0001, batch_size: 16 }, metric: 0.2 },
      { runId: uuidv7(), params: { lr: 0.001, batch_size: 32 }, metric: 0.4 },
      { runId: uuidv7(), params: { lr: 0.01, batch_size: 64 }, metric: 0.6 },
    ]);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sweeps/${SWEEP_ID}/should-terminate`,
      payload: { runId: uuidv7(), step: 5, metric: 0.9 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.shouldTerminate).toBe(true);
  });

  it("POST /sweeps/:id/should-terminate keeps above-median runs", async () => {
    seedRuns([
      { runId: uuidv7(), params: { lr: 0.0001, batch_size: 16 }, metric: 0.6 },
      { runId: uuidv7(), params: { lr: 0.001, batch_size: 32 }, metric: 0.5 },
      { runId: uuidv7(), params: { lr: 0.01, batch_size: 64 }, metric: 0.4 },
    ]);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sweeps/${SWEEP_ID}/should-terminate`,
      payload: { runId: uuidv7(), step: 5, metric: 0.1 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().shouldTerminate).toBe(false);
  });

  it("POST /sweeps/:id/should-terminate honors min_iter", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sweeps/${SWEEP_ID}/should-terminate`,
      payload: { runId: uuidv7(), step: 0, metric: 999 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().shouldTerminate).toBe(false);
  });

  it("POST /sweeps/:id/record-best selects best run per goal", async () => {
    seedRuns([
      { runId: "run-A", params: { lr: 0.01, batch_size: 32 }, metric: 0.2 },
      { runId: "run-B", params: { lr: 0.1, batch_size: 64 }, metric: 0.9 },
      { runId: "run-C", params: { lr: 0.001, batch_size: 16 }, metric: 0.7 },
    ]);
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sweeps/${SWEEP_ID}/record-best`,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().bestRunId).toBe("run-A");
  });
});

describe("sweep optimizer (pure)", () => {
  it("suggestNext is deterministic given a seeded rng", async () => {
    const { suggestNext } = await import("../../src/modules/sweep/optimizer.js");
    const config = {
      parameters: { lr: { min: 0.001, max: 0.1, distribution: "log_uniform" as const } },
      metric: { name: "val_loss", goal: "minimize" as const },
    };
    const obs = [
      { params: { lr: 0.005 }, metric: 0.4 },
      { params: { lr: 0.02 }, metric: 0.3 },
      { params: { lr: 0.05 }, metric: 0.6 },
    ];
    const a = suggestNext({ config, observations: obs, goal: "minimize", count: 3, rng: mulberry32(42) });
    const b = suggestNext({ config, observations: obs, goal: "minimize", count: 3, rng: mulberry32(42) });
    expect(a).toEqual(b);
  });
});

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}