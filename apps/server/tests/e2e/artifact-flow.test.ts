/**
 * E2E: Artifact lifecycle.
 *
 * Exercises the artifact creation + versioning endpoints against the
 * real Fastify server backed by testcontainer Postgres. Tests focus on
 * the contract surface (status codes, idempotency, validation) rather
 * than every response field — wire-shape details change frequently
 * and are best covered by integration tests on individual routes.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildE2EApp,
  signup,
  teardownE2EApp,
  type E2EApp,
} from "./helpers/build-e2e-app.js";

let e2e: E2EApp;

beforeAll(async () => {
  e2e = await buildE2EApp();
}, 60_000);

afterAll(async () => {
  if (e2e) await teardownE2EApp(e2e);
}, 30_000);

beforeEach(async () => {
  await e2e.truncateAll();
  await e2e.prisma.workspace.upsert({
    where: { id: "default" },
    create: { id: "default", name: "default", displayName: "Default Workspace" },
    update: {},
  });
});

interface ProjectRef { id: string }
interface ArtifactRef { id: string }

async function makeProject(e2e: E2EApp, token: string, name = "art-project"): Promise<ProjectRef> {
  const res = await e2e.request("/api/v1/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as ProjectRef;
}

async function makeArtifact(
  e2e: E2EApp,
  token: string,
  projectId: string,
  name: string,
  type = "dataset",
): Promise<ArtifactRef> {
  const res = await e2e.request(`/api/v1/projects/${projectId}/artifacts`, {
    method: "POST",
    token,
    body: JSON.stringify({ name, type }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as ArtifactRef;
}

describe("artifact flow", () => {
  it("creates an artifact under a project", async () => {
    const { apiKey } = await signup(e2e, "alice@example.com");
    const project = await makeProject(e2e, apiKey);
    const res = await e2e.request(`/api/v1/projects/${project.id}/artifacts`, {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({ name: "imagenet-mini", type: "dataset" }),
    });
    expect(res.status).toBe(201);
    const artifact = (await res.json()) as {
      id: string;
      projectId: string;
      name: string;
      type: string;
    };
    expect(artifact.projectId).toBe(project.id);
    expect(artifact.name).toBe("imagenet-mini");
    expect(artifact.type).toBe("dataset");
  });

  it("rejects a duplicate (projectId, name) with 409", async () => {
    const { apiKey } = await signup(e2e, "alice@example.com");
    const project = await makeProject(e2e, apiKey);
    await makeArtifact(e2e, apiKey, project.id, "dup-name");
    const dup = await e2e.request(`/api/v1/projects/${project.id}/artifacts`, {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({ name: "dup-name", type: "dataset" }),
    });
    expect(dup.status).toBe(409);
    const body = (await dup.json()) as { error: string };
    expect(body.error).toBe("Conflict");
  });

  it("creates a version with aliases", async () => {
    const { apiKey } = await signup(e2e, "alice@example.com");
    const project = await makeProject(e2e, apiKey);
    const artifact = await makeArtifact(e2e, apiKey, project.id, "ver-target");
    const res = await e2e.request(`/api/v1/artifacts/${artifact.id}/versions`, {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({ version: "v1", aliases: ["latest"] }),
    });
    expect(res.status).toBe(201);
    const version = (await res.json()) as {
      id: string;
      version: string;
      aliases: string[];
      state: string;
    };
    expect(version.version).toBe("v1");
    expect(version.aliases).toContain("latest");
  });

  it("rejects an invalid artifact type with 400", async () => {
    const { apiKey } = await signup(e2e, "alice@example.com");
    const project = await makeProject(e2e, apiKey);
    const res = await e2e.request(`/api/v1/projects/${project.id}/artifacts`, {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({ name: "bad-type", type: "spaceship" }),
    });
    expect(res.status).toBe(400);
  });

  it("attaches parent lineage and lists it back", async () => {
    const { apiKey } = await signup(e2e, "alice@example.com");
    const project = await makeProject(e2e, apiKey);
    const parent = await makeArtifact(e2e, apiKey, project.id, "parent-data");
    const child = await makeArtifact(e2e, apiKey, project.id, "child-model");

    const parentV = await e2e.request(`/api/v1/artifacts/${parent.id}/versions`, {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({ version: "v1" }),
    }).then((r) => r.json() as Promise<{ id: string }>);
    const childV = await e2e.request(`/api/v1/artifacts/${child.id}/versions`, {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({ version: "v1" }),
    }).then((r) => r.json() as Promise<{ id: string }>);

    const attachRes = await e2e.request(
      `/api/v1/versions/${childV.id}/lineage`,
      {
        method: "POST",
        token: apiKey,
        body: JSON.stringify({ parentVersionId: parentV.id, type: "derived_from" }),
      },
    );
    expect(attachRes.status).toBe(201);

    const listRes = await e2e.request(`/api/v1/versions/${childV.id}/lineage`, {
      token: apiKey,
    });
    expect(listRes.status).toBe(200);
    const lineage = (await listRes.json()) as {
      parents: Array<unknown>;
      children: Array<unknown>;
    };
    expect(lineage.parents).toHaveLength(1);
    expect(lineage.children).toHaveLength(0);
  });
});