import { describe, it, expect } from "vitest";
import { toEChartsOption } from "./echarts";
import type { ChartConfig } from "../types";
import { ChartThemeColors } from "../theme";

const mockTheme: ChartThemeColors = {
  backgroundColor: "#fff",
  textColor: "#111",
  mutedTextColor: "#666",
  gridLineColor: "#eee",
  tooltipBackground: "#222",
  tooltipBorder: "#333",
  palette: ["#f00", "#0f0", "#00f"],
};

describe("toEChartsOption", () => {
  it("builds a basic line chart option", () => {
    const config: ChartConfig = {
      title: "Loss",
      xAxis: { type: "value", name: "Step" },
      yAxis: { type: "value", name: "Loss" },
      series: [
        {
          type: "line",
          name: "train/loss",
          data: [
            [0, 1],
            [1, 0.5],
          ],
        },
      ],
    };
    const option = toEChartsOption(config, mockTheme);
    expect(option.title).toMatchObject({ text: "Loss" });
    expect(option.xAxis).toMatchObject({ type: "value", name: "Step" });
    expect(option.yAxis).toMatchObject({ type: "value", name: "Loss" });
    expect(option.series).toHaveLength(1);
    expect((option.series as any)[0].type).toBe("line");
  });

  it("builds a parallel coordinate option", () => {
    const config: ChartConfig = {
      title: "Parallel",
      series: [
        {
          type: "parallel",
          name: "runs",
          data: [
            ["run-a", 0.1, 10],
            ["run-b", 0.2, 20],
          ],
        },
      ],
      parallelAxes: [
        { dim: 0, name: "Run", type: "category", data: ["run-a", "run-b"] },
        { dim: 1, name: "lr", type: "value" },
        { dim: 2, name: "epochs", type: "value" },
      ],
    };
    const option = toEChartsOption(config, mockTheme);
    expect(option.parallelAxis).toHaveLength(3);
    expect(option.parallel).toBeDefined();
    expect(option.xAxis).toBeUndefined();
    expect(option.yAxis).toBeUndefined();
    expect((option.series as any)[0].type).toBe("parallel");
  });

  it("builds a heatmap option with visualMap", () => {
    const config: ChartConfig = {
      title: "Heatmap",
      xAxis: { type: "category", data: ["a", "b"] },
      yAxis: { type: "category", data: ["r1", "r2"] },
      series: [
        {
          type: "heatmap",
          name: "value",
          data: [
            [0, 0, 1],
            [1, 1, 9],
          ],
        },
      ],
      visualMap: { min: 0, max: 10 },
    };
    const option = toEChartsOption(config, mockTheme);
    expect((option.series as any)[0].type).toBe("heatmap");
    expect(option.visualMap).toMatchObject({ min: 0, max: 10 });
    expect(option.xAxis).toMatchObject({ type: "category", data: ["a", "b"] });
  });
});
