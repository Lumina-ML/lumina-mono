/**
 * E2E: Project + Run + Metric full data flow.
 *
 * Exercises the most common SDK path end-to-end: create a project, log
 * a few steps of metrics / system metrics / log lines, finish the run,
 * and read everything back through the public API. Every call hits the
 * real Fastify server backed by the testcontainer Postgres.
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

describe("project + run + metric", () => {
  it("creates a project, a run, logs metrics, and reads them back", async () => {
    const { apiKey } = await signup(e2e, "alice@example.com");

    // 1. Create project.
    const projectRes = await e2e.request("/api/v1/projects", {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({
        name: "demo-classifier",
        displayName: "Demo Classifier",
        description: "E2E test project",
      }),
    });
    expect(projectRes.status).toBe(201);
    const project = (await projectRes.json()) as { id: string; name: string };
    expect(project.name).toBe("demo-classifier");

    // 2. Create run under that project.
    const runRes = await e2e.request("/api/v1/runs", {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({
        project: "demo-classifier",
        name: "exp-001",
        config: { lr: 0.01, batch_size: 64 },
      }),
    });
    expect(runRes.status).toBe(201);
    const run = (await runRes.json()) as {
      id: string;
      runId: string;
      name: string;
      status: string;
      projectId: string;
    };
    expect(run.name).toBe("exp-001");
    expect(run.status).toBe("running");
    expect(run.projectId).toBe(project.id);
    expect(run.runId).toMatch(/^[0-9a-f-]{36}$/i);

    // 3. Log 5 steps of metrics + 1 system metric + 1 log line.
    for (let step = 0; step < 5; step++) {
      const metricRes = await e2e.request(
        `/api/v1/runs/${run.runId}/metrics`,
        {
          method: "POST",
          token: apiKey,
          body: JSON.stringify({
            metrics: [
              { key: "loss", step, value: 1.0 / (step + 1) },
              { key: "accuracy", step, value: step / 5.0 },
            ],
          }),
        },
      );
      expect(metricRes.status).toBe(201);
    }
    const sysRes = await e2e.request(
      `/api/v1/runs/${run.runId}/system-metrics`,
      {
        method: "POST",
        token: apiKey,
        body: JSON.stringify({
          metrics: [{ key: "cpu", step: 0, value: 42.5 }],
        }),
      },
    );
    expect(sysRes.status).toBe(201);
    const logRes = await e2e.request(
      `/api/v1/runs/${run.runId}/logs`,
      {
        method: "POST",
        token: apiKey,
        body: JSON.stringify({
          logs: [{ level: "INFO", message: "training started", step: 0 }],
        }),
      },
    );
    expect(logRes.status).toBe(201);

    // 4. Finish the run.
    const finishRes = await e2e.request(`/api/v1/runs/${run.runId}`, {
      method: "PATCH",
      token: apiKey,
      body: JSON.stringify({ status: "finished" }),
    });
    expect(finishRes.status).toBe(200);
    const finished = (await finishRes.json()) as { status: string; finishedAt: string | null };
    expect(finished.status).toBe("finished");
    expect(finished.finishedAt).not.toBeNull();

    // 5. Read everything back.
    const meRes = await e2e.request(`/api/v1/runs/${run.runId}`, { token: apiKey });
    const me = (await meRes.json()) as { status: string };
    expect(me.status).toBe("finished");

    const lossRes = await e2e.request(
      `/api/v1/runs/${run.runId}/metrics?keys=loss`,
      { token: apiKey },
    );
    expect(lossRes.status).toBe(200);
    const lossBody = (await lossRes.json()) as {
      metrics: Record<string, Array<{ step: number; value: number }>>;
    };
    expect(lossBody.metrics.loss).toHaveLength(5);

    const sysListRes = await e2e.request(
      `/api/v1/runs/${run.runId}/system-metrics`,
      { token: apiKey },
    );
    const sysList = (await sysListRes.json()) as {
      metrics: Record<string, Array<{ step: number; value: number }>>;
    };
    expect(sysList.metrics.cpu).toHaveLength(1);

    const logListRes = await e2e.request(
      `/api/v1/runs/${run.runId}/logs`,
      { token: apiKey },
    );
    const logList = (await logListRes.json()) as {
      logs: Array<{ message: string }>;
    };
    expect(logList.logs).toHaveLength(1);
    expect(logList.logs[0]!.message).toBe("training started");

    // 6. Filter runs by status.
    const listRes = await e2e.request(
      `/api/v1/runs?project=demo-classifier&status=finished`,
      { token: apiKey },
    );
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as {
      items: Array<{ runId: string }>;
      total: number;
    };
    expect(list.total).toBe(1);
    expect(list.items[0]!.runId).toBe(run.runId);
  });

  it("rejects metric logging on a non-existent run", async () => {
    const { apiKey } = await signup(e2e, "bob@example.com");
    const fakeRunId = "00000000-0000-0000-0000-000000000000";
    const res = await e2e.request(`/api/v1/runs/${fakeRunId}/metrics`, {
      method: "POST",
      token: apiKey,
      body: JSON.stringify({
        metrics: [{ key: "loss", step: 0, value: 0.5 }],
      }),
    });
    // Expect 404 (or 403 depending on authz layer); either way: not 2xx.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});