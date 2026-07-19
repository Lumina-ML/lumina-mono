import { describe, expect, it, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { launchRoutes } from "../../src/modules/launch/routes.js";
import { uuidv7 } from "../../src/shared/uuid7.js";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const QUEUE_ID = uuidv7();
const JOB_ID = uuidv7();

function fakeAuth(app: Awaited<ReturnType<typeof buildTestApp>>, runId = uuidv7()) {
  app.addHook("onRequest", async (req) => {
    (req as { user?: unknown }).user = { id: runId, email: "t@example.com", apiKey: "k" };
  });
}

describe("launch module (atomic dequeue + claim)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let prisma: ReturnType<typeof createFakePrisma>;

  beforeEach(async () => {
    prisma = createFakePrisma({
      projects: [{ id: PROJECT_ID, name: "demo" }],
      launchQueues: [{ id: QUEUE_ID, projectId: PROJECT_ID, name: "q1" }],
      launchJobs: [{ id: JOB_ID, projectId: PROJECT_ID, name: "j1" }],
      launchRuns: [
        { id: "lr-1", projectId: PROJECT_ID, queueId: QUEUE_ID, jobId: JOB_ID, status: "pending" },
        { id: "lr-2", projectId: PROJECT_ID, queueId: QUEUE_ID, jobId: JOB_ID, status: "pending" },
        { id: "lr-3", projectId: PROJECT_ID, queueId: QUEUE_ID, jobId: JOB_ID, status: "pending" },
      ],
    });
    app = await buildTestApp({ prisma });
    fakeAuth(app);
    await app.register(launchRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  it("POST /launch-queues/:id/dequeue atomically claims the oldest pending run", async () => {
    const res = await app.inject({ method: "POST", url: `/api/v1/launch-queues/${QUEUE_ID}/dequeue` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe("lr-1");
    expect(res.json().status).toBe("running");
  });

  it("Concurrent dequeues never return the same run twice", async () => {
    const results = await Promise.all(
      [1, 2, 3, 4].map(() =>
        app.inject({ method: "POST", url: `/api/v1/launch-queues/${QUEUE_ID}/dequeue` }),
      ),
    );
    const ids = new Set<string>();
    for (const r of results) {
      if (r.statusCode === 200) {
        const body = r.json();
        expect(ids.has(body.id)).toBe(false);
        ids.add(body.id);
      }
    }
    expect(ids.size).toBe(3);
  });

  it("Dequeue returns 204 when no pending runs", async () => {
    // Claim all three
    for (let i = 0; i < 3; i++) {
      const r = await app.inject({ method: "POST", url: `/api/v1/launch-queues/${QUEUE_ID}/dequeue` });
      expect(r.statusCode).toBe(200);
    }
    const fourth = await app.inject({ method: "POST", url: `/api/v1/launch-queues/${QUEUE_ID}/dequeue` });
    expect(fourth.statusCode).toBe(204);
  });

  it("Already-running runs are not picked up", async () => {
    // Mark lr-1 running directly via the prisma mock.
    const testPrisma = prisma as unknown as { launchRun: { update: Function } };
    await testPrisma.launchRun.update({ where: { id: "lr-1" }, data: { status: "running" } });
    const res = await app.inject({ method: "POST", url: `/api/v1/launch-queues/${QUEUE_ID}/dequeue` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe("lr-2");
  });
});