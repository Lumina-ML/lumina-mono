import { describe, expect, it, beforeEach } from "vitest";
import { MemoryMetricStorage } from "../../src/infra/memory/memory-metric-storage.js";

describe("MemoryMetricStorage", () => {
  let storage: MemoryMetricStorage;

  beforeEach(() => {
    storage = new MemoryMetricStorage();
  });

  it("inserts and lists metrics grouped by key", async () => {
    await storage.insertMetrics("run-1", "proj-1", [
      { key: "loss", step: 0, value: 0.9 },
      { key: "loss", step: 1, value: 0.5 },
      { key: "acc", step: 0, value: 0.1 },
    ]);

    const result = await storage.listMetrics("run-1", { limit: 100 });
    expect(result.runId).toBe("run-1");
    expect(Object.keys(result.metrics).sort()).toEqual(["acc", "loss"]);
    expect(result.metrics.loss).toEqual([
      { step: 0, value: 0.9, loggedAt: expect.any(String) },
      { step: 1, value: 0.5, loggedAt: expect.any(String) },
    ]);
    expect(result.metrics.acc).toHaveLength(1);
  });

  it("filters by keys when provided", async () => {
    await storage.insertMetrics("run-1", "proj-1", [
      { key: "loss", step: 0, value: 0.9 },
      { key: "acc", step: 0, value: 0.1 },
      { key: "lr", step: 0, value: 0.001 },
    ]);

    const result = await storage.listMetrics("run-1", { keys: ["loss"], limit: 100 });
    expect(Object.keys(result.metrics)).toEqual(["loss"]);
  });

  it("isolates rows by runId", async () => {
    await storage.insertMetrics("run-A", "proj", [{ key: "loss", step: 0, value: 1 }]);
    await storage.insertMetrics("run-B", "proj", [{ key: "loss", step: 0, value: 2 }]);

    const a = await storage.listMetrics("run-A", { limit: 100 });
    const b = await storage.listMetrics("run-B", { limit: 100 });
    expect(a.metrics.loss[0].value).toBe(1);
    expect(b.metrics.loss[0].value).toBe(2);
  });

  it("respects the limit", async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ key: "loss", step: i, value: i }));
    await storage.insertMetrics("run-1", "proj", rows);
    const result = await storage.listMetrics("run-1", { limit: 10 });
    expect(result.metrics.loss).toHaveLength(10);
  });

  it("no-ops on empty insert", async () => {
    await storage.insertMetrics("run-1", "proj", []);
    const result = await storage.listMetrics("run-1", { limit: 100 });
    expect(result.metrics).toEqual({});
  });
});