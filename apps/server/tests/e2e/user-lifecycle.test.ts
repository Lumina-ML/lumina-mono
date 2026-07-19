/**
 * E2E: User lifecycle.
 *
 * Exercises the public signup endpoint, the authenticated `me` lookup,
 * and the api-key rotation flow — all against the real Fastify server,
 * real Postgres, real auth plugin (no mocks).
 *
 * Run with: `pnpm --filter @lumina/server test:e2e`
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
  // The `buildApp()` factory seeds the default workspace on first boot;
  // truncating erases that row. Re-seed so per-request workspace context
  // still resolves for tests that don't explicitly create one.
  await e2e.prisma.workspace.upsert({
    where: { id: "default" },
    create: { id: "default", name: "default", displayName: "Default Workspace" },
    update: {},
  });
});

describe("user lifecycle", () => {
  it("signs up a new user and returns an apiKey", async () => {
    const res = await e2e.request("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({ email: "alice@example.com", name: "Alice" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      email: string;
      apiKey: string;
      name: string;
    };
    expect(body.email).toBe("alice@example.com");
    expect(body.name).toBe("Alice");
    expect(body.apiKey).toMatch(/^[a-zA-Z0-9_-]{16,}$/);
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("rejects a duplicate signup with 409", async () => {
    await signup(e2e, "alice@example.com");
    const res = await e2e.request("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({ email: "alice@example.com" }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects an invalid email with 400", async () => {
    const res = await e2e.request("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
  });

  it("resolves the current user via the bearer token", async () => {
    const { apiKey } = await signup(e2e, "alice@example.com");
    const res = await e2e.request("/api/v1/users/me", { token: apiKey });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { email: string };
    expect(body.email).toBe("alice@example.com");
  });

  it("returns 401 when no bearer token is present", async () => {
    const res = await e2e.request("/api/v1/users/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 when the bearer token is wrong", async () => {
    const res = await e2e.request("/api/v1/users/me", {
      token: "totally-bogus-key",
    });
    expect(res.status).toBe(401);
  });

  it("rotates the api key and invalidates the old one", async () => {
    const { apiKey: oldKey, userId } = await signup(e2e, "alice@example.com");

    // Old key works.
    const meBefore = await e2e.request("/api/v1/users/me", { token: oldKey });
    expect(meBefore.status).toBe(200);

    // Rotate.
    const rotateRes = await e2e.request(
      `/api/v1/users/${userId}/api-key`,
      { method: "POST", token: oldKey, body: JSON.stringify({}) },
    );
    expect(rotateRes.status).toBe(200);
    const rotated = (await rotateRes.json()) as { apiKey: string };
    expect(rotated.apiKey).not.toBe(oldKey);

    // New key works.
    const meAfter = await e2e.request("/api/v1/users/me", { token: rotated.apiKey });
    expect(meAfter.status).toBe(200);

    // Old key now 401s.
    const meOld = await e2e.request("/api/v1/users/me", { token: oldKey });
    expect(meOld.status).toBe(401);
  });
});