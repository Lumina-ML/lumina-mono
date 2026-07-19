import { describe, expect, it, beforeEach } from "vitest";
import { MemoryTimeSeriesStorage } from "../../src/infra/memory/memory-time-series-storage.js";

describe("MemoryTimeSeriesStorage", () => {
  let storage: MemoryTimeSeriesStorage;

  beforeEach(() => {
    storage = new MemoryTimeSeriesStorage();
  });

  describe("system_metric", () => {
    it("inserts and queries by runId", async () => {
      const t0 = new Date("2024-01-01T00:00:00Z");
      const t1 = new Date("2024-01-01T00:00:01Z");
      await storage.insertBatch("system_metric", [
        { runId: "r1", projectId: "p1", key: "cpu", step: 0, value: 0.1, loggedAt: t0 },
        { runId: "r1", projectId: "p1", key: "cpu", step: 1, value: 0.2, loggedAt: t1 },
        { runId: "r2", projectId: "p1", key: "cpu", step: 0, value: 0.9, loggedAt: t0 },
      ]);

      const rows = await storage.query("system_metric", { runId: "r1", limit: 100 });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.runId === "r1")).toBe(true);
    });

    it("filters by time range", async () => {
      const t0 = new Date("2024-01-01T00:00:00Z");
      const t1 = new Date("2024-01-02T00:00:00Z");
      const t2 = new Date("2024-01-03T00:00:00Z");
      await storage.insertBatch("system_metric", [
        { runId: "r1", projectId: "p1", key: "cpu", step: 0, value: 1, loggedAt: t0 },
        { runId: "r1", projectId: "p1", key: "cpu", step: 1, value: 2, loggedAt: t1 },
        { runId: "r1", projectId: "p1", key: "cpu", step: 2, value: 3, loggedAt: t2 },
      ]);

      const rows = await storage.query("system_metric", {
        runId: "r1",
        start: new Date("2024-01-01T12:00:00Z"),
        end: new Date("2024-01-02T12:00:00Z"),
        limit: 100,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe(2);
    });
  });

  describe("log_line", () => {
    it("inserts and queries in ascending timestamp order by default", async () => {
      const t0 = new Date("2024-01-01T00:00:00Z");
      const t1 = new Date("2024-01-01T00:00:02Z");
      const t2 = new Date("2024-01-01T00:00:01Z");
      await storage.insertBatch("log_line", [
        { runId: "r1", projectId: "p1", level: "INFO", message: "second", timestamp: t1 },
        { runId: "r1", projectId: "p1", level: "INFO", message: "first", timestamp: t0 },
        { runId: "r1", projectId: "p1", level: "INFO", message: "middle", timestamp: t2 },
      ]);

      const rows = await storage.query("log_line", {
        runId: "r1",
        limit: 10,
        orderBy: { column: "timestamp", direction: "asc" },
      });
      expect(rows.map((r) => r.message)).toEqual(["first", "middle", "second"]);
    });

    it("isolates rows by runId", async () => {
      const t = new Date();
      await storage.insertBatch("log_line", [
        { runId: "r1", projectId: "p1", level: "INFO", message: "a", timestamp: t },
      ]);
      await storage.insertBatch("log_line", [
        { runId: "r2", projectId: "p1", level: "INFO", message: "b", timestamp: t },
      ]);

      const r1Rows = await storage.query("log_line", { runId: "r1", limit: 10 });
      const r2Rows = await storage.query("log_line", { runId: "r2", limit: 10 });
      expect(r1Rows).toHaveLength(1);
      expect(r2Rows).toHaveLength(1);
      expect(r1Rows[0].message).toBe("a");
      expect(r2Rows[0].message).toBe("b");
    });
  });

  it("reset() clears all tables", async () => {
    await storage.insertBatch("system_metric", [
      { runId: "r1", projectId: "p1", key: "cpu", step: 0, value: 1, loggedAt: new Date() },
    ]);
    await storage.insertBatch("log_line", [
      { runId: "r1", projectId: "p1", level: "INFO", message: "x", timestamp: new Date() },
    ]);

    storage.reset();
    const sys = await storage.query("system_metric", { limit: 10 });
    const logs = await storage.query("log_line", { limit: 10 });
    expect(sys).toEqual([]);
    expect(logs).toEqual([]);
  });
});