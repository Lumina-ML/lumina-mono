import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { artifactLinkRoutes } from "../../src/modules/artifact-link/routes.js";

const VERSION_ID = "0190a5b8-7c8e-7def-8000-000000000090";

describe("POST /api/v1/versions/:id/link (step 3.2 sender link-artifact)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({
        // Seed the version → artifact → project chain so the workspace
        // guard's lookupArtifactVersion resolves.
        projects: [{ id: "p1", workspaceId: "default", name: "registry" }],
        artifacts: [{ id: "a1", projectId: "p1", name: "fashion-mnist", type: "dataset" }],
        artifactVersions: [{ id: VERSION_ID, artifactId: "a1", version: "v1" }],
      }),
    });
    await app.register(artifactLinkRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("creates a portfolio link with aliases", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/link`,
      payload: {
        portfolioName: "fashion-mnist",
        portfolioProject: "registry",
        portfolioEntity: "team-a",
        aliases: ["latest", "v1.2"],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.artifactVersionId).toBe(VERSION_ID);
    expect(body.portfolioName).toBe("fashion-mnist");
    expect(body.portfolioProject).toBe("registry");
    expect(body.aliases).toEqual(["latest", "v1.2"]);
    expect(body.versionIndex).toBe(0);
    expect(body.linkId).toBeTypeOf("string");
  });

  it("creates a link without entity or aliases", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/link`,
      payload: {
        portfolioName: "minimal",
        portfolioProject: "registry",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.aliases).toEqual([]);
  });

  it("rejects missing portfolio fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/link`,
      payload: { portfolioName: "x" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});