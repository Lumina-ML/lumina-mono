import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { runFileRoutes } from "../../src/modules/run-file/routes.js";
import { LocalObjectStorage } from "../../src/infra/storage/local.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const RUN_ID = "0190a5b8-7c8e-7def-8000-000000000010";

describe("run-file module (SDK save/restore backend)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "lumina-files-"));
    app = await buildTestApp({
      prisma: createFakePrisma({ runs: [{ runId: RUN_ID, projectId: "p1" }] }),
    });
    // Swap in a fresh LocalObjectStorage pointed at tmpDir for isolation.
    (app as unknown as { storage: LocalObjectStorage }).storage = new LocalObjectStorage({
      baseUrl: "http://localhost:0",
      basePath: tmpDir,
    });
    await app.register(runFileRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("POST /runs/:runId/files stores file content in object storage", async () => {
    const content = Buffer.from("hello world").toString("base64");
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/files`,
      payload: { path: "checkpoints/step-0.bin", contentBase64: content },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.path).toBe("checkpoints/step-0.bin");
    expect(body.size).toBe(11);

    // Confirm object storage actually has the bytes.
    const storage = (app as unknown as { storage: LocalObjectStorage }).storage;
    const bytes = await storage.getBuffer(`runs/${RUN_ID}/files/checkpoints/step-0.bin`);
    expect(bytes.toString()).toBe("hello world");
  });

  it("GET /runs/:runId/files lists files registered via metadata", async () => {
    const content = Buffer.from("a").toString("base64");
    await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/files`,
      payload: { path: "a.txt", contentBase64: content },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/files`,
      payload: { path: "b.txt", contentBase64: content },
    });

    const res = await app.inject({ method: "GET", url: `/api/v1/runs/${RUN_ID}/files` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.files.map((f: { path: string }) => f.path).sort()).toEqual(["a.txt", "b.txt"]);
  });

  it("GET /runs/:runId/file?path=... returns file content base64", async () => {
    const content = Buffer.from("payload").toString("base64");
    await app.inject({
      method: "POST",
      url: `/api/v1/runs/${RUN_ID}/files`,
      payload: { path: "data.txt", contentBase64: content },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${RUN_ID}/file?path=data.txt`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Buffer.from(body.contentBase64, "base64").toString()).toBe("payload");
  });

  it("GET /runs/:runId/file returns 404 for missing files", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${RUN_ID}/file?path=missing.txt`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST returns 404 when run does not exist", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/runs/nope/files`,
      payload: { path: "x", contentBase64: Buffer.from("y").toString("base64") },
    });
    expect(res.statusCode).toBe(404);
  });
});