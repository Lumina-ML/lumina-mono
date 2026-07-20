import { describe, it, expect } from "vitest";
import {
  smoothSeries,
  clipOutliers,
  mapXAxis,
  aggregateByX,
  buildAggregatedSeries,
  evaluateExpression,
  deriveMetric,
} from "./transforms";
import type { MetricPoint, MetricSeries } from "./transforms";

function pts(values: number[]): MetricPoint[] {
  return values.map((value, step) => ({ step, value }));
}

function series(name: string, values: number[]): MetricSeries {
  return { name, key: "loss", data: pts(values) };
}

describe("smoothSeries", () => {
  it("returns original data when smoothing <= 0", () => {
    const input = pts([1, 2, 3]);
    expect(smoothSeries(input, 0)).toEqual(input);
    expect(smoothSeries(input, -1)).toEqual(input);
  });

  it("computes trailing moving average", () => {
    const input = pts([1, 2, 3, 4, 5]);
    const out = smoothSeries(input, 2);
    expect(out.map((p) => p.value)).toEqual([1, 1.5, 2.5, 3.5, 4.5]);
    expect(out.map((p) => p.step)).toEqual([0, 1, 2, 3, 4]);
  });

  it("computes exponential smoothing", () => {
    const input = pts([0, 10, 10, 10]);
    const out = smoothSeries(input, 1, "exponential");
    // alpha = 1/2
    expect(out[0]!.value).toBe(0);
    expect(out[1]!.value).toBeCloseTo(5);
    expect(out[2]!.value).toBeCloseTo(7.5);
    expect(out[3]!.value).toBeCloseTo(8.75);
  });
});

describe("clipOutliers", () => {
  it("leaves normal data unchanged", () => {
    const input = pts([1, 2, 3, 4, 5]);
    expect(clipOutliers(input, 0, 1).map((p) => p.value)).toEqual([1, 2, 3, 4, 5]);
  });

  it("clips values outside percentile bounds", () => {
    const input = pts([0, 1, 2, 3, 4, 5, 100]);
    const out = clipOutliers(input, 0.1, 0.9).map((p) => p.value);
    expect(out[0]).toBeGreaterThan(0); // clipped up
    expect(out[out.length - 1]).toBeLessThan(100); // clipped down
  });
});

describe("mapXAxis", () => {
  it("maps step mode", () => {
    const input: MetricPoint[] = [
      { step: 10, value: 1 },
      { step: 20, value: 2 },
    ];
    expect(mapXAxis(input, "step")).toEqual([
      [10, 1],
      [20, 2],
    ]);
  });

  it("maps wall time from loggedAt strings", () => {
    const t1 = Date.parse("2026-07-21T00:00:00Z");
    const t2 = Date.parse("2026-07-21T00:00:01Z");
    const input: MetricPoint[] = [
      { step: 0, value: 1, loggedAt: "2026-07-21T00:00:00Z" },
      { step: 1, value: 2, loggedAt: "2026-07-21T00:00:01Z" },
    ];
    expect(mapXAxis(input, "wall")).toEqual([
      [t1, 1],
      [t2, 2],
    ]);
  });

  it("maps relative time with explicit baseTime", () => {
    const input: MetricPoint[] = [
      { step: 0, value: 1, loggedAt: "2026-07-21T00:00:01Z" },
      { step: 1, value: 2, loggedAt: "2026-07-21T00:00:03Z" },
    ];
    const base = Date.parse("2026-07-21T00:00:00Z");
    expect(mapXAxis(input, "relative", { baseTime: base })).toEqual([
      [1000, 1],
      [3000, 2],
    ]);
  });

  it("maps metric mode using metricByStep", () => {
    const input: MetricPoint[] = [
      { step: 1, value: 10 },
      { step: 2, value: 20 },
      { step: 3, value: 30 },
    ];
    expect(mapXAxis(input, "metric", { metricByStep: { 1: 0.1, 2: 0.2 } })).toEqual([
      [0.1, 10],
      [0.2, 20],
    ]);
  });
});

describe("aggregateByX", () => {
  it("computes mean/std/min/max across runs", () => {
    const bands = aggregateByX([series("a", [1, 2, 3]), series("b", [3, 2, 1])]);
    expect(bands).toHaveLength(3);
    expect(bands[0]).toMatchObject({ x: 0, mean: 2, min: 1, max: 3 });
    expect(bands[1]).toMatchObject({ x: 1, mean: 2, min: 2, max: 2, std: 0 });
  });
});

describe("buildAggregatedSeries", () => {
  it("builds mean ± std bands", () => {
    const out = buildAggregatedSeries(
      [series("a", [1, 2]), series("b", [3, 4])],
      "mean",
    );
    expect(out).toHaveLength(3);
    expect(out[0]!.name).toBe("loss (mean)");
    expect(out[1]!.name).toBe("loss (+σ)");
    expect(out[2]!.name).toBe("loss (-σ)");
    expect(out[0]!.data.map((p) => p.value)).toEqual([2, 3]);
  });

  it("builds min/max envelope", () => {
    const out = buildAggregatedSeries(
      [series("a", [1, 5]), series("b", [3, 1])],
      "min",
    );
    expect(out.map((s) => s.name)).toEqual(["loss (mean)", "loss (min)", "loss (max)"]);
  });
});

describe("evaluateExpression", () => {
  it("evaluates arithmetic", () => {
    expect(evaluateExpression("1 + 2 * 3", {})).toBe(7);
    expect(evaluateExpression("(1 + 2) * 3", {})).toBe(9);
  });

  it("substitutes variables", () => {
    expect(evaluateExpression("loss / acc", { loss: 0.5, acc: 0.9 })).toBeCloseTo(0.5556, 3);
  });

  it("supports metric-like variable names", () => {
    expect(
      evaluateExpression("train/loss + val/loss", {
        "train/loss": 1,
        "val/loss": 2,
      }),
    ).toBe(3);
  });

  it("calls functions", () => {
    expect(evaluateExpression("max(1, 5, 3)", {})).toBe(5);
    expect(evaluateExpression("abs(-4)", {})).toBe(4);
    expect(evaluateExpression("pow(2, 3)", {})).toBe(8);
  });

  it("throws on unknown variable", () => {
    expect(() => evaluateExpression("x + 1", {})).toThrow('Unknown variable "x"');
  });

  it("throws on unknown function", () => {
    expect(() => evaluateExpression("foo(1)", {})).toThrow('Unknown function "foo"');
  });
});

describe("deriveMetric", () => {
  it("computes derived metric across aligned steps", () => {
    const metricsByKey = {
      loss: pts([1, 2, 3]),
      acc: pts([0.9, 0.8, 0.7]),
    };
    const derived = deriveMetric(metricsByKey, "loss / acc", { name: "loss_per_acc" });
    expect(derived.name).toBe("loss_per_acc");
    expect(derived.data).toHaveLength(3);
    expect(derived.data[0]!.value).toBeCloseTo(1 / 0.9, 5);
  });

  it("skips steps where a variable is missing", () => {
    const metricsByKey = {
      a: [{ step: 0, value: 1 }],
      b: [{ step: 1, value: 2 }],
    };
    const derived = deriveMetric(metricsByKey, "a + b");
    expect(derived.data).toHaveLength(0);
  });
});
