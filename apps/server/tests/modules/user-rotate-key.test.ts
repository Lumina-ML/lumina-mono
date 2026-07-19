import { describe, expect, it } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import { TEST_CONFIG } from "../helpers/build-app.js";
import { userRoutes } from "../../src/modules/user/routes.js";

interface FakeUser {
  id: string;
  email: string;
  apiKey: string;
}

/**
 * Minimal Prisma stub covering the `user.findUnique` / `user.update` surface
 * the user module touches. Keeps rows mutable so a rotate is observable.
 */
function makeUserPrisma(seed: FakeUser[]) {
  const rows = seed.map((u) => ({ ...u }));
  return {
    user: {
      findUnique: async ({ where }: { where: Partial<FakeUser> }) => {
        if (where.email !== undefined)
          return rows.find((r) => r.email === where.email) ?? null;
        if (where.id !== undefined)
          return rows.find((r) => r.id === where.id) ?? null;
        if (where.apiKey !== undefined)
          return rows.find((r) => r.apiKey === where.apiKey) ?? null;
        return null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeUser>;
      }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error("user not found");
        Object.assign(row, data);
        return { ...row };
      },
    },
    // Expose rows so assertions can read the post-rotate state.
    __rows: rows,
  };
}

const ADMIN: FakeUser = {
  id: "0190a5b8-7c8e-7def-8000-0000000000aa",
  email: "admin@acme.com",
  apiKey: "old-key-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

async function build(allowlist: string[], seed: FakeUser[]) {
  const app = fastify({ logger: false });
  const prisma = makeUserPrisma(seed);
  app.decorate("config", { ...TEST_CONFIG, rotateKeyEmails: allowlist });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate("prisma", prisma as any);
  await app.register(userRoutes, { prefix: "/api/v1" });
  await app.ready();
  return { app, prisma };
}

function rotate(app: FastifyInstance, email: string) {
  return app.inject({
    method: "POST",
    url: `/api/v1/users/${encodeURIComponent(email)}/rotate-key`,
  });
}

describe("POST /users/:email/rotate-key (unauthenticated key recovery)", () => {
  let app: FastifyInstance;

  it("404s when the allowlist is empty (feature disabled)", async () => {
    ({ app } = await build([], [ADMIN]));
    const res = await rotate(app, ADMIN.email);
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("404s for an email that is not on the allowlist", async () => {
    ({ app } = await build(["someone@else.com"], [ADMIN]));
    const res = await rotate(app, ADMIN.email);
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("404s for an allowlisted email with no matching user (no enumeration)", async () => {
    ({ app } = await build(["ghost@acme.com"], [ADMIN]));
    const res = await rotate(app, "ghost@acme.com");
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("rotates and returns a fresh key for an allowlisted user", async () => {
    const built = await build([ADMIN.email], [ADMIN]);
    app = built.app;
    const res = await rotate(app, ADMIN.email);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.apiKey).toBe("string");
    expect(body.apiKey.length).toBeGreaterThan(16);
    expect(body.apiKey).not.toBe(ADMIN.apiKey);
    // The stored key actually changed.
    expect(built.prisma.__rows[0].apiKey).toBe(body.apiKey);
    await app.close();
  });

  it("is case-insensitive on the email", async () => {
    ({ app } = await build([ADMIN.email], [ADMIN]));
    const res = await rotate(app, "ADMIN@ACME.COM");
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("429s after exceeding the per-window attempt limit", async () => {
    ({ app } = await build([ADMIN.email], [ADMIN]));
    // Limiter is 5 attempts / window (per email + per IP). The 6th trips it.
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await rotate(app, ADMIN.email);
      statuses.push(res.statusCode);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
    await app.close();
  });
});
