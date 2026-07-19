import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { artifactRoutes } from "../../src/modules/artifact/routes.js";
import { uuidv7 } from "../../src/shared/uuid7.js";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const ARTIFACT_ID = uuidv7();
const VERSION_ID = uuidv7();

describe("artifact module (dedup / manifest / lineage / reference)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let emitted: Array<{ type: string; payload: unknown }> = [];
  let queued: Array<{ name: string; payload: unknown }> = [];

  beforeEach(async () => {
    emitted = [];
    queued = [];
    app = await buildTestApp({
      prisma: createFakePrisma({
        projects: [{ id: PROJECT_ID, name: "demo" }],
        artifacts: [{ id: ARTIFACT_ID, projectId: PROJECT_ID, name: "model" }],
        artifactVersions: [
          { id: VERSION_ID, artifactId: ARTIFACT_ID, version: "v0", aliases: ["latest"] },
        ],
      }),
    });
    // Wire up event-bus + queue capture for assertions.
    app.eventBus.publish = async (event) => {
      emitted.push({ type: event.type, payload: event.payload });
    };
    app.queue.enqueue = async (job) => {
      queued.push({ name: job.name, payload: job.payload });
    };
    await app.register(artifactRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("adds a content file with content-addressed storage key", async () => {
    const sha = "a".repeat(64);
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/files`,
      payload: { path: "model.bin", size: 1024, sha256: sha, contentType: "application/octet-stream" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.file.path).toBe("model.bin");
    expect(body.file.sha256).toBe(sha);
    expect(body.file.storageKey).toBe(`blobs/sha256/${sha.slice(0, 2)}/${sha}/model.bin`);
    expect(body.uploadUrl).toBeTruthy();
  });

  it("falls back to random storage key when sha256 is omitted", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/files`,
      payload: { path: "raw.bin", size: 10 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().file.storageKey).toMatch(new RegExp(`^${ARTIFACT_ID}/${VERSION_ID}/[^/]+/raw\\.bin$`));
  });

  it("rejects duplicate path within the same version", async () => {
    await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/files`,
      payload: { path: "dup.bin", size: 1 },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/files`,
      payload: { path: "dup.bin", size: 1 },
    });
    expect(res.statusCode).toBe(409);
  });

  it("stores a reference artifact without an upload URL", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/files`,
      payload: { path: "external.bin", size: 0, referenceUri: "s3://other-bucket/path" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.file.referenceUri).toBe("s3://other-bucket/path");
    expect(body.file.storageKey).toBeNull();
    expect(body.uploadUrl).toBeNull();
  });

  it("finalizeVersion builds manifest, computes digest, emits event, enqueues job", async () => {
    const sha1 = "1".repeat(64);
    const sha2 = "2".repeat(64);
    await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/files`,
      payload: { path: "a.bin", size: 100, sha256: sha1 },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/files`,
      payload: { path: "b.bin", size: 200, sha256: sha2 },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/finalize`,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(body.manifest).toMatchObject({
      version: 1,
      entries: [
        { path: "a.bin", digest: sha1, size: "100" },
        { path: "b.bin", digest: sha2, size: "200" },
      ],
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0].type).toBe("ArtifactUploaded");
    expect(emitted[0].payload).toMatchObject({
      artifactVersionId: VERSION_ID,
      projectId: ARTIFACT_ID,
      fileCount: 2,
    });

    expect(queued).toHaveLength(1);
    expect(queued[0].name).toBe("artifact.uploaded");
  });

  it("manifest digest is deterministic regardless of insertion order", async () => {
    const shaA = "a".repeat(64);
    const shaB = "b".repeat(64);
    await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/files`,
      payload: { path: "z.bin", size: 1, sha256: shaB },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/files`,
      payload: { path: "a.bin", size: 1, sha256: shaA },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/finalize`,
      payload: {},
    });
    const entries = res.json().manifest.entries;
    expect(entries.map((e: { path: string }) => e.path)).toEqual(["a.bin", "z.bin"]);
  });

  it("attaches and lists lineage edges between two versions", async () => {
    const parentId = uuidv7();
    // We need a second version row; build it directly via the prisma mock.
    (app.prisma as unknown as { artifactVersion: { create: Function } }).artifactVersion.create({
      data: { id: parentId, artifactId: ARTIFACT_ID, version: "parent-v0", aliases: [], metadata: {}, state: "committed" },
    });

    const attach = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/lineage`,
      payload: { parentVersionId: parentId, type: "derived_from" },
    });
    expect(attach.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/versions/${VERSION_ID}/lineage`,
    });
    expect(list.statusCode).toBe(200);
    const body = list.json();
    expect(body.parents).toHaveLength(1);
    expect(body.parents[0].version.id).toBe(parentId);
    expect(body.parents[0].type).toBe("derived_from");
  });

  it("rejects self-lineage", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/lineage`,
      payload: { parentVersionId: VERSION_ID, type: "derived_from" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when attaching unknown lineage", async () => {
    const missing = uuidv7();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/lineage`,
      payload: { parentVersionId: missing, type: "derived_from" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("detaches lineage", async () => {
    const parentId = uuidv7();
    (app.prisma as unknown as { artifactVersion: { create: Function } }).artifactVersion.create({
      data: { id: parentId, artifactId: ARTIFACT_ID, version: "p", aliases: [], metadata: {}, state: "committed" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/versions/${VERSION_ID}/lineage`,
      payload: { parentVersionId: parentId, type: "used" },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/versions/${VERSION_ID}/lineage/${parentId}`,
    });
    expect(res.statusCode).toBe(204);

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/versions/${VERSION_ID}/lineage`,
    });
    expect(list.json().parents).toEqual([]);
  });
});