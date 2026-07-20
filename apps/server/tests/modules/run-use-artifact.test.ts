import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { runUseArtifactRoutes } from "../../src/modules/run-use-artifact/routes.js";

const RUN_ID = "0190a5b8-7c8e-7def-8000-000000000080";

describe("POST /api/v1/runs/:id/use-artifact (step 3.2 sender use-artifact)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({
        runs: [{ runId: RUN_ID, projectId: "p1", name: "exp" }],
      }),
    });
    await app.register(runUseArtifactRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("records a use-artifact entry with type", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/use-artifact`,
      payload: {
        artifactVersionId: "av-1",
        type: "input",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.runId).toBe(RUN_ID);
    expect(body.artifactVersionId).toBe("av-1");
    expect(body.useArtifactId).toBeTypeOf("string");
  });

  it("records a use-artifact entry without type", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/use-artifact`,
      payload: { artifactVersionId: "av-2" },
    });
    expect(res.statusCode).toBe(201);
  });

  it("rejects missing artifactVersionId", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/use-artifact`,
      payload: {},
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});