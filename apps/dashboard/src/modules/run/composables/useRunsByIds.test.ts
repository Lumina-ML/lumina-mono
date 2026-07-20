import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { useRunsByIds } from "./useRunsByIds";
import { RunService } from "@/services/run.service";
import type { Run } from "@/types/run";

vi.mock("@/services/run.service", () => ({
  RunService: {
    get: vi.fn(),
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
    config: {},
    summary: {},
    metadata: {},
    notes: null,
    sweepId: null,
  } as unknown) as Run;

describe("useRunsByIds", () => {
  beforeEach(() => {
    vi.mocked(RunService.get).mockReset();
  });

  it("is disabled when runIds is empty", () => {
    const { result } = withQueryClient(() => useRunsByIds(ref([])));
    expect(result.isLoading.value).toBe(false);
    expect(RunService.get).not.toHaveBeenCalled();
  });

  it("fetches runs in parallel", async () => {
    const runs = [makeRun("id1"), makeRun("id2")];
    vi.mocked(RunService.get)
      .mockResolvedValueOnce(runs[0]!)
      .mockResolvedValueOnce(runs[1]!);

    const { result } = withQueryClient(() => useRunsByIds(ref(["id1", "id2"])));

    await flushPromises();

    expect(RunService.get).toHaveBeenCalledTimes(2);
    expect(RunService.get).toHaveBeenNthCalledWith(1, "id1");
    expect(RunService.get).toHaveBeenNthCalledWith(2, "id2");
    expect(result.data.value).toEqual(runs);
  });
});
