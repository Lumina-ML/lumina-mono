import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { mount, flushPromises, RouterLinkStub } from "@vue/test-utils";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import RunCompare from "./RunCompare.vue";
import type { Run } from "@/types/run";

const makeRun = (runId: string): Run =>
  ({
    runId,
    id: runId,
    name: `run-${runId.slice(0, 4)}`,
    projectId: "p1",
    status: "finished",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    config: { lr: 0.01, epochs: 10 },
    summary: { loss: 0.2, acc: 0.9 },
    metadata: {},
    notes: null,
    sweepId: null,
  } as unknown) as Run;

vi.mock("vue-router", () => ({
  useRoute: () => ({
    params: { projectId: "p1" },
    query: { runIds: "id1,id2" },
  }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: RouterLinkStub,
}));

vi.mock("@/modules/run/composables/useRunsByIds", () => ({
  useRunsByIds: () => ({
    data: ref([makeRun("id1"), makeRun("id2")]),
    isLoading: ref(false),
    isError: ref(false),
    error: ref(null),
  }),
}));

vi.mock("@/modules/metric/composables/useCompareMetrics", () => ({
  useCompareMetrics: () => ({
    data: ref({
      runs: [
        {
          runId: "id1",
          metrics: {
            loss: [{ step: 0, value: 0.5, loggedAt: "" }],
          },
        },
        {
          runId: "id2",
          metrics: {
            loss: [{ step: 0, value: 0.4, loggedAt: "" }],
          },
        },
      ],
    }),
    isLoading: ref(false),
    isError: ref(false),
    error: ref(null),
  }),
}));

vi.mock("@/widgets/metric-chart/MetricChart.vue", () => ({
  default: {
    props: ["metrics", "title", "height"],
    template: '<div class="mock-metric-chart" :data-title="title">MetricChart</div>',
  },
}));

const LTabsStub = {
  props: ["modelValue"],
  emits: ["update:value"],
  template: '<div class="mock-tabs"><slot /></div>',
};

const LTabPaneStub = {
  props: ["name", "tab"],
  template: '<div class="mock-tab-pane" :data-name="name" :data-tab="tab"><span>{{ tab }}</span><slot /></div>',
};

const LParallelChartStub = {
  props: ["axes", "rows", "title", "height"],
  template: '<div class="mock-parallel-chart">ParallelChart</div>',
};

const LHeatmapChartStub = {
  props: ["xLabels", "yLabels", "data", "title", "height"],
  template: '<div class="mock-heatmap-chart">HeatmapChart</div>',
};

describe("RunCompare", () => {
  it("renders run names and comparison tabs", async () => {
    const queryClient = new QueryClient();
    const wrapper = mount(RunCompare, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        stubs: {
          RouterLink: RouterLinkStub,
          LTabs: LTabsStub,
          LTabPane: LTabPaneStub,
          LParallelChart: LParallelChartStub,
          LHeatmapChart: LHeatmapChartStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Run Comparison");
    expect(wrapper.text()).toContain("run-id1");
    expect(wrapper.text()).toContain("run-id2");
    expect(wrapper.text()).toContain("Metrics");
    expect(wrapper.text()).toContain("Config");
    expect(wrapper.text()).toContain("Summary");
  });

  it("renders metric charts for common keys", async () => {
    const queryClient = new QueryClient();
    const wrapper = mount(RunCompare, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        stubs: {
          RouterLink: RouterLinkStub,
          LTabs: LTabsStub,
          LTabPane: LTabPaneStub,
          LParallelChart: LParallelChartStub,
          LHeatmapChart: LHeatmapChartStub,
        },
      },
    });

    await flushPromises();

    const charts = wrapper.findAll(".mock-metric-chart");
    expect(charts.length).toBeGreaterThan(0);
    expect(charts[0]!.attributes("data-title")).toBe("loss");
  });
});
