import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import ChartPanel from "./ChartPanel.vue";
import type { ChartPanelConfig } from "./ChartPanel.vue";
import type { Run } from "@/types/run";
import { RunService } from "@/services/run.service";
import { MetricService } from "@/services/metric.service";

vi.mock("@/services/run.service");
vi.mock("@/services/metric.service");

const ChartRendererStub = {
  props: ["config", "height"],
  template:
    '<div class="mock-chart-renderer" :data-title="config.title">{{ config.series.length }}</div>',
};

const ChartConfigModalStub = {
  props: ["open", "config", "runIds", "runNames"],
  template: '<div class="mock-config-modal"></div>',
};

function makeRun(runId: string): Run {
  return {
    runId,
    id: runId,
    name: `run-${runId}`,
    projectId: "p1",
    status: "finished",
    createdAt: "2026-07-21T00:00:00Z",
    updatedAt: "2026-07-21T00:00:00Z",
    finishedAt: "2026-07-21T00:00:00Z",
    config: {},
    summary: {},
    metadata: {},
    notes: null,
    sweepId: null,
  } as Run;
}

function makeMetrics(runId: string) {
  return {
    runId,
    metrics: {
      loss: [
        { step: 0, value: 1, loggedAt: "2026-07-21T00:00:00Z" },
        { step: 1, value: 2, loggedAt: "2026-07-21T00:00:01Z" },
        { step: 2, value: 3, loggedAt: "2026-07-21T00:00:02Z" },
      ],
    },
  };
}

function mountPanel(config: Partial<ChartPanelConfig> = {}, runIds: string[] = ["r1", "r2"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return mount(ChartPanel, {
    props: {
      config: {
        title: "Test panel",
        metricKeys: ["loss"],
        ...config,
      } as ChartPanelConfig,
      runIds,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        ChartRenderer: ChartRendererStub,
        ChartConfigModal: ChartConfigModalStub,
      },
    },
  });
}

describe("ChartPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(RunService.get).mockImplementation((id) => Promise.resolve(makeRun(id)));
    vi.mocked(MetricService.list).mockImplementation((runId) =>
      Promise.resolve(makeMetrics(runId as string)),
    );
  });

  it("renders a line series per run and metric key", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    const renderer = wrapper.findComponent(ChartRendererStub);
    expect(renderer.exists()).toBe(true);
    const cfg = renderer.props("config") as { series: Array<{ name: string; type: string }> };
    expect(cfg.series).toHaveLength(2);
    expect(cfg.series[0]!.name).toContain("run-r1");
    expect(cfg.series[0]!.name).toContain("loss");
    expect(cfg.series[0]!.type).toBe("line");
  });

  it("honors chart type from config modal", async () => {
    const wrapper = mountPanel({
      data: { chartType: "bar" },
    });
    await flushPromises();

    const cfg = wrapper.findComponent(ChartRendererStub).props("config") as {
      series: Array<{ type: string }>;
    };
    expect(cfg.series.every((s) => s.type === "bar")).toBe(true);
  });

  it("uses log y-axis when configured", async () => {
    const wrapper = mountPanel({ data: { yAxis: "log" } });
    await flushPromises();

    const cfg = wrapper.findComponent(ChartRendererStub).props("config") as {
      yAxis: { type: string };
    };
    expect(cfg.yAxis.type).toBe("log");
  });

  it("applies smoothing and outlier clipping from config modal", async () => {
    const wrapper = mountPanel({
      data: { smoothing: 2, outlierClip: true },
    });
    await flushPromises();

    const cfg = wrapper.findComponent(ChartRendererStub).props("config") as {
      series: Array<{ data: Array<[number, number]> }>;
    };
    expect(cfg.series).toHaveLength(2);
    // 3 input points survive smoothing window=2 and clipping.
    expect(cfg.series[0]!.data).toHaveLength(3);
  });

  it("aggregates runs when aggregation is set and 3+ runs are selected", async () => {
    const wrapper = mountPanel(
      {
        grouping: { groupBy: null, aggregation: "mean" },
      },
      ["r1", "r2", "r3"],
    );
    await flushPromises();

    const cfg = wrapper.findComponent(ChartRendererStub).props("config") as {
      series: Array<{ name: string }>;
    };
    const names = cfg.series.map((s) => s.name);
    expect(names).toContain("loss (mean)");
    expect(names).toContain("loss (+σ)");
    expect(names).toContain("loss (-σ)");
  });
});
