import { describe, expect, it, beforeEach } from "vitest";
import { MemoryEventBus } from "../../src/infra/memory/memory-event-bus.js";

describe("MemoryEventBus", () => {
  let bus: MemoryEventBus;

  beforeEach(() => {
    bus = new MemoryEventBus();
  });

  it("delivers published events to subscribers", async () => {
    const received: number[] = [];
    bus.subscribe("MetricLogged", (event) => {
      received.push((event.payload as { count: number }).count);
    });

    await bus.publish({ type: "MetricLogged", payload: { runId: "r1", projectId: "p1", workspaceId: "w1", keys: ["loss"], count: 3 }, occurredAt: new Date() });
    await bus.publish({ type: "MetricLogged", payload: { runId: "r1", projectId: "p1", workspaceId: "w1", keys: ["acc"], count: 5 }, occurredAt: new Date() });

    expect(received).toEqual([3, 5]);
  });

  it("isolates handlers by event type", async () => {
    let metricCount = 0;
    let runCount = 0;

    bus.subscribe("MetricLogged", () => {
      metricCount++;
    });
    bus.subscribe("RunFinished", () => {
      runCount++;
    });

    await bus.publish({ type: "MetricLogged", payload: { runId: "r1", projectId: "p1", workspaceId: "w1", keys: [], count: 1 }, occurredAt: new Date() });
    await bus.publish({ type: "RunFinished", payload: { runId: "r1", projectId: "p1", workspaceId: "w1", status: "finished" }, occurredAt: new Date() });

    expect(metricCount).toBe(1);
    expect(runCount).toBe(1);
  });

  it("does not throw when a handler errors", async () => {
    bus.subscribe("MetricLogged", () => {
      throw new Error("handler boom");
    });
    bus.subscribe("MetricLogged", (_event) => {
      // No-op; just here to ensure the second handler still runs.
    });

    // Suppress console.error noise during the test
    const originalError = console.error;
    console.error = () => {};
    try {
      await bus.publish({ type: "MetricLogged", payload: { runId: "r1", projectId: "p1", workspaceId: "w1", keys: [], count: 1 }, occurredAt: new Date() });
    } finally {
      console.error = originalError;
    }
  });

  it("supports multiple subscribers for the same event", async () => {
    const a: number[] = [];
    const b: number[] = [];
    bus.subscribe("MetricLogged", (event) => {
      a.push((event.payload as { count: number }).count);
    });
    bus.subscribe("MetricLogged", (event) => {
      b.push((event.payload as { count: number }).count);
    });

    await bus.publish({ type: "MetricLogged", payload: { runId: "r1", projectId: "p1", workspaceId: "w1", keys: [], count: 7 }, occurredAt: new Date() });
    expect(a).toEqual([7]);
    expect(b).toEqual([7]);
  });
});