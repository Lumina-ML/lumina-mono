import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { runRoutes } from "../../src/modules/run/routes.js";

const RUN_ID = "0190a5b8-7c8e-7def-8000-000000000020";

describe("run preempting / pinned-config-keys (SDK stubs backend)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({ runs: [{ runId: RUN_ID, projectId: "p1" }] }),
    });
    await app.register(runRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("PATCH /runs/:id accepts status=preempting", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/runs/${RUN_ID}`,
      payload: { status: "preempting" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("preempting");
  });

  it("PATCH /runs/:id stores pinnedConfigKeys in metadata", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/runs/${RUN_ID}`,
      payload: { metadata: { pinnedConfigKeys: ["lr", "batch_size"] } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.metadata.pinnedConfigKeys).toEqual(["lr", "batch_size"]);
  });
});