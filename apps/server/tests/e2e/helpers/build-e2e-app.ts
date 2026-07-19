/**
 * E2E test app builder.
 *
 * Wraps the REAL `buildApp()` from `src/bootstrap.ts` — no mocks, no
 * in-memory infrastructure. After global-setup.ts has populated
 * `process.env` with testcontainer URLs, this helper:
 *
 *   1. Imports `buildApp` (which loads config from env).
 *   2. `app.listen({ port: 0, host: "127.0.0.1" })` so the OS picks
 *      a free port and we never collide with parallel test runs.
 *   3. Returns `{ baseUrl, app, request, prisma, headersFor(user) }`
 *      so individual tests can issue real HTTP requests against a
 *      real Postgres-backed server.
 *
 * `truncateAll()` runs `TRUNCATE … RESTART IDENTITY CASCADE` on every
 * domain table between tests so they start from a clean slate without
 * the cost of dropping/recreating the schema.
 */

import type { FastifyInstance } from "fastify";
import { buildApp } from "../../../src/bootstrap.js";
import { PrismaClient } from "../../../src/generated/prisma/index.js";

export interface E2EApp {
  baseUrl: string;
  app: FastifyInstance;
  prisma: PrismaClient;
  /** Truncate every domain table. Cascade FKs so child rows die too. */
  truncateAll: () => Promise<void>;
  /** Issue a fetch with sensible defaults (JSON body, baseUrl prefix). */
  request: (
    path: string,
    init?: RequestInit & { token?: string },
  ) => Promise<Response>;
}

export async function buildE2EApp(): Promise<E2EApp> {
  const app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("buildE2EApp: app failed to bind to a TCP port");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const prisma = app.prisma as PrismaClient;

  /**
   * Truncate in FK-safe order. Listing every table by hand is
   * annoying but `prisma.$executeRawUnsafe('TRUNCATE … CASCADE')` is
   * much faster than running `deleteMany()` per model — important
   * when each test resets state. We use the schema introspection API
   * to discover the table list dynamically so adding a new model
   * doesn't silently leak state between tests.
   */
  async function truncateAll(): Promise<void> {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const names = tables
      .map((t) => t.table_name)
      // _prisma_migrations is owned by Prisma migrate; leave it alone.
      .filter((n) => n !== "_prisma_migrations")
      .map((n) => `"${n}"`)
      .join(", ");
    if (names.length > 0) {
      await prisma.$executeRawUnsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
    }
  }

  async function request(
    path: string,
    init?: RequestInit & { token?: string },
  ): Promise<Response> {
    const { token, headers, ...rest } = init ?? {};
    const finalHeaders = new Headers(headers);
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
    if (rest.body && !finalHeaders.has("Content-Type")) {
      finalHeaders.set("Content-Type", "application/json");
    }
    return fetch(`${baseUrl}${path}`, { ...rest, headers: finalHeaders });
  }

  return {
    baseUrl,
    app,
    prisma,
    truncateAll,
    request,
  };
}

/**
 * Tear down a previously-built E2E app. Closes the Fastify listener
 * and disconnects Prisma. Always pair this with a `try/finally` so a
 * failing test doesn't leak connections to the Postgres container.
 */
export async function teardownE2EApp(handle: E2EApp): Promise<void> {
  await handle.app.close();
  await handle.prisma.$disconnect();
}

/**
 * Helper: create a user via the public signup endpoint, returning
 * `{ userId, apiKey, email }`. Tests that need bearer auth use this
 * to bootstrap identity.
 */
export async function signup(
  e2e: E2EApp,
  email: string,
): Promise<{ userId: string; apiKey: string; email: string }> {
  const res = await e2e.request("/api/v1/users", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { id: string; apiKey: string; email: string };
  return { userId: body.id, apiKey: body.apiKey, email: body.email };
}