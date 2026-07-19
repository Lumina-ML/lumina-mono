import { describe, expect, it, beforeEach } from "vitest";
import { MemoryTraceStorage } from "../../src/infra/memory/memory-trace-storage.js";

describe("MemoryTraceStorage", () => {
  let storage: MemoryTraceStorage;

  beforeEach(() => {
    storage = new MemoryTraceStorage();
  });

  describe("traces", () => {
    it("inserts and finds by traceId", async () => {
      await storage.insertTrace({
        projectId: "p1",
        traceId: "t1",
        name: "agent",
        status: "ok",
        startedAt: new Date(),
      });
      const found = await storage.findTrace("t1");
      expect(found?.name).toBe("agent");
      expect(found?.projectId).toBe("p1");
    });

    it("lists traces by projectId in descending order", async () => {
      const older = new Date("2024-01-01T00:00:00Z");
      const newer = new Date("2024-01-02T00:00:00Z");
      await storage.insertTrace({ projectId: "p1", traceId: "t1", name: "older", status: "ok", startedAt: older });
      await storage.insertTrace({ projectId: "p1", traceId: "t2", name: "newer", status: "ok", startedAt: newer });
      await storage.insertTrace({ projectId: "p2", traceId: "t3", name: "other", status: "ok", startedAt: newer });

      const rows = await storage.listTraces({ projectId: "p1" });
      expect(rows).toHaveLength(2);
      expect(rows[0].traceId).toBe("t2");
      expect(rows[1].traceId).toBe("t1");
    });

    it("updates trace fields", async () => {
      await storage.insertTrace({
        projectId: "p1",
        traceId: "t1",
        name: "x",
        status: "ok",
        startedAt: new Date(),
      });
      const updated = await storage.updateTrace("t1", {
        status: "error",
        latencyMs: 50,
        finishedAt: new Date(),
      });
      expect(updated?.status).toBe("error");
      expect(updated?.latencyMs).toBe(50);
      expect(updated?.finishedAt).toBeInstanceOf(Date);
    });

    it("returns null when updating a missing trace", async () => {
      const updated = await storage.updateTrace("missing", { status: "ok" });
      expect(updated).toBeNull();
    });
  });

  describe("spans", () => {
    it("inserts and finds by spanId", async () => {
      await storage.insertTrace({
        projectId: "p1",
        traceId: "t1",
        name: "agent",
        status: "ok",
        startedAt: new Date(),
      });
      await storage.insertSpan({
        traceId: "t1",
        spanId: "s1",
        name: "step",
        kind: "llm",
        input: { prompt: "hi" },
        output: {},
        status: "ok",
        startedAt: new Date(),
      });
      const found = await storage.findSpan("s1");
      expect(found?.name).toBe("step");
      expect(found?.kind).toBe("llm");
      expect(found?.input).toEqual({ prompt: "hi" });
    });

    it("lists spans by traceId in ascending order", async () => {
      await storage.insertTrace({ projectId: "p1", traceId: "t1", name: "x", status: "ok", startedAt: new Date() });
      const t0 = new Date("2024-01-01T00:00:00Z");
      const t1 = new Date("2024-01-01T00:00:01Z");
      const t2 = new Date("2024-01-01T00:00:02Z");
      await storage.insertSpan({ traceId: "t1", spanId: "s2", name: "b", kind: "internal", status: "ok", startedAt: t1, input: {}, output: {} });
      await storage.insertSpan({ traceId: "t1", spanId: "s1", name: "a", kind: "internal", status: "ok", startedAt: t0, input: {}, output: {} });
      await storage.insertSpan({ traceId: "t1", spanId: "s3", name: "c", kind: "internal", status: "ok", startedAt: t2, input: {}, output: {} });

      const rows = await storage.listSpans({ traceId: "t1" });
      expect(rows.map((r) => r.spanId)).toEqual(["s1", "s2", "s3"]);
    });

    it("updates span fields", async () => {
      await storage.insertTrace({ projectId: "p1", traceId: "t1", name: "x", status: "ok", startedAt: new Date() });
      await storage.insertSpan({
        traceId: "t1",
        spanId: "s1",
        name: "step",
        kind: "internal",
        input: {},
        output: {},
        status: "ok",
        startedAt: new Date(),
      });
      const updated = await storage.updateSpan("s1", {
        status: "error",
        output: { err: "boom" },
        finishedAt: new Date(),
      });
      expect(updated?.status).toBe("error");
      expect(updated?.output).toEqual({ err: "boom" });
    });
  });

  it("reset() clears all data", async () => {
    await storage.insertTrace({ projectId: "p1", traceId: "t1", name: "x", status: "ok", startedAt: new Date() });
    await storage.insertSpan({
      traceId: "t1",
      spanId: "s1",
      name: "x",
      kind: "internal",
      input: {},
      output: {},
      status: "ok",
      startedAt: new Date(),
    });
    storage.reset();
    expect(await storage.findTrace("t1")).toBeNull();
    expect(await storage.findSpan("s1")).toBeNull();
  });
});