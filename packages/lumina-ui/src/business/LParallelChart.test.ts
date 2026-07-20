import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LParallelChart from "./LParallelChart.vue";

const ChartRendererStub = {
  props: ["config", "height"],
  template: '<div class="mock-renderer" />',
};

describe("LParallelChart", () => {
  it("renders ChartRenderer with parallel config", () => {
    const wrapper = mount(LParallelChart, {
      props: {
        title: "Dimensions",
        axes: [
          { dim: 0, name: "Run", type: "category", data: ["a", "b"] },
          { dim: 1, name: "lr", type: "value" },
        ],
        rows: [["a", 0.1]],
      },
      global: { stubs: { ChartRenderer: ChartRendererStub } },
    });

    const renderer = wrapper.findComponent(ChartRendererStub);
    expect(renderer.exists()).toBe(true);
    const cfg = renderer.props("config") as { series: Array<{ type: string }>; parallelAxes: unknown };
    expect(cfg.series[0]!.type).toBe("parallel");
    expect(cfg.parallelAxes).toHaveLength(2);
    expect(renderer.props("height")).toBe("360px");
  });
});
