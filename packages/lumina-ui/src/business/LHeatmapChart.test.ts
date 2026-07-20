import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LHeatmapChart from "./LHeatmapChart.vue";

const ChartRendererStub = {
  props: ["config", "height"],
  template: '<div class="mock-renderer" />',
};

describe("LHeatmapChart", () => {
  it("renders ChartRenderer with heatmap config and visualMap", () => {
    const wrapper = mount(LHeatmapChart, {
      props: {
        title: "Matrix",
        xLabels: ["x1", "x2"],
        yLabels: ["y1", "y2"],
        data: [
          [0, 0, 1],
          [1, 1, 9],
        ],
      },
      global: { stubs: { ChartRenderer: ChartRendererStub } },
    });

    const renderer = wrapper.findComponent(ChartRendererStub);
    expect(renderer.exists()).toBe(true);
    const cfg = renderer.props("config") as {
      series: Array<{ type: string }>;
      visualMap: { min: number; max: number };
      xAxis: { data: string[] };
    };
    expect(cfg.series[0]!.type).toBe("heatmap");
    expect(cfg.visualMap.min).toBe(1);
    expect(cfg.visualMap.max).toBe(9);
    expect(cfg.xAxis.data).toEqual(["x1", "x2"]);
  });
});
