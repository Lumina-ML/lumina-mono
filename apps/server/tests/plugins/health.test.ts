import { describe, expect, it, beforeEach, vi } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { healthPlugin } from "../../src/plugins/health.js";

const mockPing = vi.fn();
const mockQuit = vi.fn();

vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    ping: mockPing,
    quit: mockQuit,
  })),
}));

describe("/healthz and /readyz", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPing.mockReset();
    mockQuit.mockReset();
    app = await buildTestApp({
      prisma: createFakePrisma(),
    });
    await app.register(healthPlugin);
    await app.ready();
  });

  it("GET /healthz returns ok + uptime", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.uptimeSec).toBe("number");
    expect(body.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it("GET /readyz reports postgres as degraded when $queryRaw throws", async () => {
    // Override the fake Prisma to throw on $queryRaw so the readiness
    // check sees a degraded dependency. The fake returns the user-
    // supplied object directly, so we can replace the method.
    const failingPrisma = {
      ...createFakePrisma(),
      $queryRaw: () => Promise.reject(new Error("connection refused")),
    };
    const failingApp = await buildTestApp({
      // Cast so the strict PrismaClient partial type doesn't reject the
      // `$queryRaw` override — the helper takes `Partial<PrismaClient>`
      // but we're deliberately replacing the method to simulate failure.
      prisma: failingPrisma as unknown as ReturnType<typeof createFakePrisma>,
    });
    await failingApp.register(healthPlugin);
    await failingApp.ready();

    const res = await failingApp.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe("degraded");
    const pgCheck = body.checks.find(
      (c: { name: string }) => c.name === "postgres",
    );
    expect(pgCheck.ok).toBe(false);
    expect(pgCheck.detail).toContain("connection refused");
  });

  it("GET /readyz returns ready when all dependencies are ok", async () => {
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ready");
    expect(Array.isArray(body.checks)).toBe(true);
    for (const c of body.checks) expect(c.ok).toBe(true);
  });

  it("GET /readyz reports redis as not configured when REDIS_URL is absent", async () => {
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    const redisCheck = res.json().checks.find(
      (c: { name: string }) => c.name === "redis",
    );
    expect(redisCheck.ok).toBe(true);
    expect(redisCheck.detail).toBe("not configured");
  });

  it("GET /readyz reports redis as ok when ping succeeds", async () => {
    mockPing.mockResolvedValueOnce("PONG");
    app.config.redisUrl = "redis://localhost:6379";
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    const redisCheck = res.json().checks.find(
      (c: { name: string }) => c.name === "redis",
    );
    expect(redisCheck.ok).toBe(true);
    expect(mockQuit).toHaveBeenCalled();
  });

  it("GET /readyz reports redis as degraded when ping fails", async () => {
    mockPing.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    app.config.redisUrl = "redis://localhost:6379";
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(503);
    const redisCheck = res.json().checks.find(
      (c: { name: string }) => c.name === "redis",
    );
    expect(redisCheck.ok).toBe(false);
    expect(redisCheck.detail).toContain("ECONNREFUSED");
    expect(mockQuit).toHaveBeenCalled();
  });
});