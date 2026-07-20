import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, nextTick } from "vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { useCompareMetrics } from "./useCompareMetrics";
import { MetricService } from "@/services/metric.service";

vi.mock("@/services/metric.service", () => ({
  MetricService: {
    compare: vi.fn(),
  },
}));

function withQueryClient<T>(useFn: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(
    {
      setup() {
        const result = useFn();
        return { result };
      },
      template: "<div />",
    },
    {
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
    },
  );
  return { result: wrapper.vm.result as T, queryClient };
}

describe("useCompareMetrics", () => {
  beforeEach(() => {
    vi.mocked(MetricService.compare).mockReset();
  });

  it("is disabled when fewer than 2 runIds", () => {
    const { result } = withQueryClient(() => useCompareMetrics(ref(["id1"])));
    expect(result.isLoading.value).toBe(false);
    expect(MetricService.compare).not.toHaveBeenCalled();
  });

  it("calls MetricService.compare with runIds and joined keys", async () => {
    vi.mocked(MetricService.compare).mockResolvedValueOnce({ runs: [] });
    const runIds = ref(["id1", "id2"]);
    const keys = ref(["loss", "acc"]);
    withQueryClient(() => useCompareMetrics(runIds, keys));

    await flushPromises();

    expect(MetricService.compare).toHaveBeenCalledWith({
      runIds: ["id1", "id2"],
      keys: "loss,acc",
    });
  });

  it("omits keys when not provided", async () => {
    vi.mocked(MetricService.compare).mockResolvedValueOnce({ runs: [] });
    const runIds = ref(["id1", "id2"]);
    withQueryClient(() => useCompareMetrics(runIds));

    await flushPromises();

    expect(MetricService.compare).toHaveBeenCalledWith({
      runIds: ["id1", "id2"],
    });
  });

  it("returns data from MetricService.compare", async () => {
    const response = {
      runs: [
        { runId: "id1", metrics: { loss: [{ step: 0, value: 0.5, loggedAt: "" }] } },
      ],
    };
    vi.mocked(MetricService.compare).mockResolvedValueOnce(response);
    const runIds = ref(["id1", "id2"]);
    const { result } = withQueryClient(() => useCompareMetrics(runIds));

    await flushPromises();
    await nextTick();

    expect(result.data.value).toEqual(response);
  });
});
