import { describe, expect, it } from "vitest";
import fastify, { type FastifyInstance } from "fastify";
import { TEST_CONFIG } from "../helpers/build-app.js";
import {
  workspaceContextPlugin,
  WORKSPACE_HEADER,
} from "../../src/plugins/workspace-context.js";

interface FakeMembership {
  workspaceId: string;
  userId: string;
  createdAt: Date;
}

/** Prisma stub covering the workspaceMembership surface the plugin reads. */
function makePrisma(memberships: FakeMembership[]) {
  return {
    workspaceMembership: {
      findUnique: async ({
        where,
      }: {
        where: { workspaceId_userId: { workspaceId: string; userId: string } };
      }) => {
        const { workspaceId, userId } = where.workspaceId_userId;
        return (
          memberships.find(
            (m) => m.workspaceId === workspaceId && m.userId === userId,
          ) ?? null
        );
      },
      findFirst: async ({ where }: { where: { userId: string } }) => {
        const mine = memberships
          .filter((m) => m.userId === where.userId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return mine[0] ?? null;
      },
    },
  };
}

const USER = { id: "u-1", email: "u1@acme.com", apiKey: "key-u1" };

async function build(memberships: FakeMembership[]) {
  const app = fastify({ logger: false });
  app.decorate("config", { ...TEST_CONFIG });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate("prisma", makePrisma(memberships) as any);

  // Minimal auth hook: Bearer key-u1 → USER, everything else anonymous.
  app.decorateRequest("user", undefined);
  app.addHook("onRequest", async (req) => {
    const auth = req.headers.authorization;
    if (auth === `Bearer ${USER.apiKey}`) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).user = USER;
    }
  });

  await app.register(workspaceContextPlugin);
  app.get("/whoami", async (req) => ({ workspaceId: req.workspaceId }));
  await app.ready();
  return app;
}

const AUTHED = { authorization: `Bearer ${USER.apiKey}` };

describe("workspaceContextPlugin (X-Lumina-Workspace resolution)", () => {
  let app: FastifyInstance;

  it("anonymous request → server default workspace", async () => {
    app = await build([]);
    const res = await app.inject({ method: "GET", url: "/whoami" });
    expect(res.json().workspaceId).toBe(TEST_CONFIG.defaultWorkspaceId);
    await app.close();
  });

  it("anonymous request ignores an explicit header (no scoping bypass)", async () => {
    app = await build([]);
    const res = await app.inject({
      method: "GET",
      url: "/whoami",
      headers: { [WORKSPACE_HEADER]: "ws-secret" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().workspaceId).toBe(TEST_CONFIG.defaultWorkspaceId);
    await app.close();
  });

  it("authed, no header → the user's first membership", async () => {
    app = await build([
      { workspaceId: "ws-a", userId: USER.id, createdAt: new Date(2000, 0, 1) },
      { workspaceId: "ws-b", userId: USER.id, createdAt: new Date(2001, 0, 1) },
    ]);
    const res = await app.inject({ method: "GET", url: "/whoami", headers: AUTHED });
    expect(res.json().workspaceId).toBe("ws-a");
    await app.close();
  });

  it("authed, header naming a workspace the user belongs to → that workspace", async () => {
    app = await build([
      { workspaceId: "ws-a", userId: USER.id, createdAt: new Date(2000, 0, 1) },
      { workspaceId: "ws-b", userId: USER.id, createdAt: new Date(2001, 0, 1) },
    ]);
    const res = await app.inject({
      method: "GET",
      url: "/whoami",
      headers: { ...AUTHED, [WORKSPACE_HEADER]: "ws-b" },
    });
    expect(res.json().workspaceId).toBe("ws-b");
    await app.close();
  });

  it("authed, header naming a workspace the user is NOT in → 403 WORKSPACE_FORBIDDEN", async () => {
    app = await build([
      { workspaceId: "ws-a", userId: USER.id, createdAt: new Date(2000, 0, 1) },
    ]);
    const res = await app.inject({
      method: "GET",
      url: "/whoami",
      headers: { ...AUTHED, [WORKSPACE_HEADER]: "ws-other" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("WORKSPACE_FORBIDDEN");
    await app.close();
  });

  it("authed, empty header → treated as no selection (first membership)", async () => {
    app = await build([
      { workspaceId: "ws-a", userId: USER.id, createdAt: new Date(2000, 0, 1) },
    ]);
    const res = await app.inject({
      method: "GET",
      url: "/whoami",
      headers: { ...AUTHED, [WORKSPACE_HEADER]: "  " },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().workspaceId).toBe("ws-a");
    await app.close();
  });
});
