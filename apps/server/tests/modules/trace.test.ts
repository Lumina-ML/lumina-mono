import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { traceRoutes } from "../../src/modules/trace/routes.js";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

describe("trace module (TraceStorage abstraction)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp({
      prisma: createFakePrisma({ projects: [{ id: PROJECT_ID, name: "demo" }] }),
    });
    await app.register(traceRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("POST /projects/:projectId/traces creates a trace in traceStorage", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${PROJECT_ID}/traces`,
      payload: { name: "llm-call", metadata: { model: "gpt-4" } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.traceId).toBeDefined();
    expect(body.name).toBe("llm-call");
    expect(body.metadata).toEqual({ model: "gpt-4" });

    const stored = await app.traceStorage.findTrace(body.traceId);
    expect(stored?.name).toBe("llm-call");
    expect(stored?.metadata).toEqual({ model: "gpt-4" });
  });

  it("POST returns 404 when project does not exist", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/projects/22222222-2222-4222-8222-222222222222/traces`,
      payload: { name: "x" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET /traces/:traceId flattens {trace,spans} to { ...trace, spans }", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${PROJECT_ID}/traces`,
      payload: { name: "chain" },
    });
    const trace = created.json();

    await app.inject({
      method: "POST",
      url: `/api/v1/traces/${trace.traceId}/spans`,
      payload: { name: "step1", kind: "llm" },
    });

    const res = await app.inject({ method: "GET", url: `/api/v1/traces/${trace.traceId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.traceId).toBe(trace.traceId);
    expect(body.name).toBe("chain");
    expect(Array.isArray(body.spans)).toBe(true);
    expect(body.spans).toHaveLength(1);
    expect(body.spans[0].name).toBe("step1");
    expect(body.spans[0].kind).toBe("llm");
  });

  it("PATCH /traces/:traceId finishes a trace", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${PROJECT_ID}/traces`,
      payload: { name: "t" },
    });
    const trace = created.json();

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/traces/${trace.traceId}`,
      payload: { status: "ok", latencyMs: 123 },
    });
    expect(res.statusCode).toBe(200);

    const stored = await app.traceStorage.findTrace(trace.traceId);
    expect(stored?.status).toBe("ok");
    expect(stored?.latencyMs).toBe(123);
    expect(stored?.finishedAt).toBeInstanceOf(Date);
  });

  it("POST /traces/:traceId/spans resolves parent span by natural spanId", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${PROJECT_ID}/traces`,
      payload: { name: "t" },
    });
    const trace = created.json();

    const parent = await app.inject({
      method: "POST",
      url: `/api/v1/traces/${trace.traceId}/spans`,
      payload: { name: "parent", spanId: "span-parent-natural-id" },
    });
    expect(parent.statusCode).toBe(201);

    const child = await app.inject({
      method: "POST",
      url: `/api/v1/traces/${trace.traceId}/spans`,
      payload: {
        name: "child",
        parentSpanId: "span-parent-natural-id",
      },
    });
    expect(child.statusCode).toBe(201);
    expect(child.json().parentSpanId).toBe("span-parent-natural-id");

    const fetched = await app.traceStorage.findSpan("span-parent-natural-id");
    expect(fetched?.spanId).toBe("span-parent-natural-id");
    const childRow = await app.traceStorage.findSpan(child.json().spanId);
    expect(childRow?.parentSpanId).toBe("span-parent-natural-id");
  });

  it("POST /traces/:traceId/spans returns 404 for unknown parent", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${PROJECT_ID}/traces`,
      payload: { name: "t" },
    });
    const trace = created.json();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/traces/${trace.traceId}/spans`,
      payload: { name: "child", parentSpanId: "missing-parent" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /traces/:traceId/spans returns 404 when trace does not exist", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/traces/does-not-exist/spans`,
      payload: { name: "x" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("PATCH /spans/:spanId finishes a span", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${PROJECT_ID}/traces`,
      payload: { name: "t" },
    });
    const trace = created.json();

    const span = await app.inject({
      method: "POST",
      url: `/api/v1/traces/${trace.traceId}/spans`,
      payload: { name: "s", spanId: "span-1" },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/spans/span-1`,
      payload: { status: "ok", output: { answer: 42 }, latencyMs: 7 },
    });
    expect(res.statusCode).toBe(200);

    const stored = await app.traceStorage.findSpan("span-1");
    expect(stored?.status).toBe("ok");
    expect(stored?.output).toEqual({ answer: 42 });
    expect(stored?.latencyMs).toBe(7);
    expect(stored?.finishedAt).toBeInstanceOf(Date);
  });

  it("GET /projects/:projectId/traces returns traces for a project", async () => {
    await app.inject({
      method: "POST",
      url: `/api/v1/projects/${PROJECT_ID}/traces`,
      payload: { name: "a" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/projects/${PROJECT_ID}/traces`,
      payload: { name: "b" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${PROJECT_ID}/traces`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(2);
  });
});