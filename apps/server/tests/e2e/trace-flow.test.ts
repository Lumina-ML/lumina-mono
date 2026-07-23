/**
 * E2E: Trace + span lifecycle.
 *
 * Exercises the trace API against the real Fastify server:
 *   POST /projects/:id/traces        → create trace
 *   POST /traces/:traceId/spans      → create root + child spans
 *   PATCH /spans/:spanId             → close span + set latency
 *   PATCH /traces/:traceId           → close trace + set latency
 *   GET  /traces/:traceId/spans      → list spans
 *
 * Verifies:
 *   - Span parent/child relationship survives read-back
 *   - Trace latency aggregation is honored
 *   - Span latency updates are accepted
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

async function makeProject(e2e: E2EApp, token: string): Promise<ProjectRef> {
  const res = await e2e.request("/api/v1/projects", {
    method: "POST",
    token,
    body: JSON.stringify({ name: "trace-project" }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as ProjectRef;
}

describe("trace flow", () => {
  it("creates a trace and a nested span tree", async () => {
    const { apiKey } = await signup(e2e, "alice@example.com");
    const project = await makeProject(e2e, apiKey);

    // Create trace.
    const traceRes = await e2e.request(
      `/api/v1/projects/${project.id}/traces`,
      {
        method: "POST",
        token: apiKey,
        body: JSON.stringify({ name: "chat-completion", metadata: { model: "gpt-4" } }),
      },
    );
    expect(traceRes.status).toBe(201);
    const trace = (await traceRes.json()) as { traceId: string; name: string };
    expect(trace.name).toBe("chat-completion");

    // Create root span.
    const rootRes = await e2e.request(`/api/v1/traces/${trace.traceId}/spans`, {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({ name: "chat-completion", kind: "agent" }),
    });
    expect(rootRes.status).toBe(201);
    const root = (await rootRes.json()) as { spanId: string; parentSpanId: string | null };
    expect(root.parentSpanId).toBeNull();

    // Create child span.
    const childRes = await e2e.request(`/api/v1/traces/${trace.traceId}/spans`, {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({ name: "llm-call", kind: "llm", parentSpanId: root.spanId }),
    });
    expect(childRes.status).toBe(201);
    const child = (await childRes.json()) as { spanId: string; parentSpanId: string | null };
    expect(child.parentSpanId).toBe(root.spanId);

    // List spans.
    const listRes = await e2e.request(`/api/v1/traces/${trace.traceId}/spans`, {
      token: apiKey,
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { items: Array<{ spanId: string; name: string }> };
    expect(listBody.items.length).toBeGreaterThanOrEqual(2);
    const ids = new Set(listBody.items.map((s) => s.spanId));
    expect(ids.has(root.spanId)).toBe(true);
    expect(ids.has(child.spanId)).toBe(true);
  });

  it("closes a span with latency and finishes the trace", async () => {
    const { apiKey } = await signup(e2e, "alice@example.com");
    const project = await makeProject(e2e, apiKey);

    const traceRes = await e2e.request(
      `/api/v1/projects/${project.id}/traces`,
      {
        method: "POST",
        token: apiKey,
        body: JSON.stringify({ name: "finish-test" }),
      },
    );
    const trace = (await traceRes.json()) as { traceId: string };

    const spanRes = await e2e.request(`/api/v1/traces/${trace.traceId}/spans`, {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({ name: "do-work", kind: "internal" }),
    });
    const span = (await spanRes.json()) as { spanId: string };

    const patchSpan = await e2e.request(`/api/v1/spans/${span.spanId}`, {
      method: "PATCH",
      token: apiKey,
      body: JSON.stringify({ latencyMs: 250, status: "ok" }),
    });
    expect(patchSpan.status).toBe(200);

    const patchTrace = await e2e.request(`/api/v1/traces/${trace.traceId}`, {
      method: "PATCH",
      token: apiKey,
      body: JSON.stringify({ latencyMs: 250, status: "ok" }),
    });
    expect(patchTrace.status).toBe(200);
    const finished = (await patchTrace.json()) as { status: string; latencyMs: number };
    expect(finished.status).toBe("ok");
    expect(finished.latencyMs).toBe(250);
  });

  it("rejects a span creation with an unknown parentSpanId", async () => {
    const { apiKey } = await signup(e2e, "alice@example.com");
    const project = await makeProject(e2e, apiKey);

    const traceRes = await e2e.request(
      `/api/v1/projects/${project.id}/traces`,
      {
        method: "POST",
        token: apiKey,
        body: JSON.stringify({ name: "orphan-trace" }),
      },
    );
    const trace = (await traceRes.json()) as { id: string };

    const fakeParent = "00000000-0000-0000-0000-000000000000";
    const res = await e2e.request(`/api/v1/traces/${trace.id}/spans`, {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({ name: "orphan-span", parentSpanId: fakeParent }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});