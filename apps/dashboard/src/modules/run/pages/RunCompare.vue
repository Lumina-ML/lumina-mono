<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import {
  LCard,
  LButton,
  LEmpty,
  LSkeleton,
  LTabs,
  LTabPane,
  LParallelChart,
  LHeatmapChart,
} from "@lumina/ui";
import { ArrowLeft } from "lucide-vue-next";
import { useRunsByIds } from "@/modules/run/composables/useRunsByIds";
import { useCompareMetrics } from "@/modules/metric/composables/useCompareMetrics";
import { useDateFormat } from "@/composables/useDateFormat";
import { colorForRunId } from "@/composables/useRunColor";
import RunStatusBadge from "@/widgets/run-status-badge/RunStatusBadge.vue";
import MetricChart from "@/widgets/metric-chart/MetricChart.vue";
import QueryBoundary from "@/components/QueryBoundary.vue";

const route = useRoute();
const router = useRouter();
const { formatDate } = useDateFormat();

const projectId = computed(() => route.params.projectId as string);
const runIds = computed(() => {
  const raw = route.query.runIds;
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
});

const { data: runs, isLoading: runsLoading, isError: runsError, error: runsErrorObj } = useRunsByIds(runIds);
const { data: compareData, isLoading: metricsLoading, isError: metricsError, error: metricsErrorObj } = useCompareMetrics(runIds);

const isLoading = computed(() => runsLoading.value || metricsLoading.value);
const isError = computed(() => runsError.value || metricsError.value);
const error = computed(() => runsErrorObj.value ?? metricsErrorObj.value);

const activeTab = ref("metrics");

const runsById = computed(() => {
  const map = new Map<string, NonNullable<typeof runs.value>[number]>();
  runs.value?.forEach((run) => map.set(run.runId, run));
  return map;
});

const orderedRuns = computed(() => runIds.value.map((id) => runsById.value.get(id)).filter(Boolean));

const commonMetricKeys = computed(() => {
  if (!compareData.value?.runs.length) return [];
  const keySets = compareData.value.runs.map((r) => new Set(Object.keys(r.metrics)));
  const common = keySets.reduce((acc, set) => acc.filter((k) => set.has(k)), [...keySets[0]!]);
  return common.sort();
});

const chartMetricsByKey = computed(() => {
  const result: Record<string, Record<string, { step: number; value: number; loggedAt: string }[]>> = {};
  if (!compareData.value) return result;
  for (const run of compareData.value.runs) {
    const runName = runsById.value.get(run.runId)?.name ?? run.runId.slice(0, 8);
    for (const [key, points] of Object.entries(run.metrics)) {
      if (!result[key]) result[key] = {};
      result[key]![runName] = points;
    }
  }
  return result;
});

const configKeys = computed(() => {
  const keys = new Set<string>();
  orderedRuns.value.forEach((run) => {
    if (run?.config && typeof run.config === "object") {
      Object.keys(run.config).forEach((k) => keys.add(k));
    }
  });
  return [...keys].sort();
});

const summaryKeys = computed(() => {
  const keys = new Set<string>();
  orderedRuns.value.forEach((run) => {
    if (run?.summary && typeof run.summary === "object") {
      Object.keys(run.summary).forEach((k) => keys.add(k));
    }
  });
  return [...keys].sort();
});

const numericSummaryKeys = computed(() =>
  summaryKeys.value.filter((k) =>
    orderedRuns.value.some(
      (run) => typeof (run!.summary as Record<string, unknown>)?.[k] === "number",
    ),
  ),
);

const numericConfigKeys = computed(() =>
  configKeys.value.filter((k) =>
    orderedRuns.value.some(
      (run) => typeof (run!.config as Record<string, unknown>)?.[k] === "number",
    ),
  ),
);

const hasParallelData = computed(
  () => orderedRuns.value.length >= 2 && numericSummaryKeys.value.length + numericConfigKeys.value.length > 0,
);

const parallelAxes = computed(() => {
  const dims = ["Run", ...numericSummaryKeys.value, ...numericConfigKeys.value];
  return dims.map((name, idx) => ({
    dim: idx,
    name,
    type: name === "Run" ? ("category" as const) : ("value" as const),
    data: name === "Run" ? orderedRuns.value.map((run) => run!.name) : undefined,
  }));
});

const parallelRows = computed(() =>
  orderedRuns.value.map((run) => [
    run!.name,
    ...numericSummaryKeys.value.map(
      (k) => ((run!.summary as Record<string, unknown>)?.[k] as number) ?? 0,
    ),
    ...numericConfigKeys.value.map(
      (k) => ((run!.config as Record<string, unknown>)?.[k] as number) ?? 0,
    ),
  ]),
);

const heatmapData = computed(() => {
  const rows: Array<[number, number, number]> = [];
  numericSummaryKeys.value.forEach((key, xIdx) => {
    orderedRuns.value.forEach((run, yIdx) => {
      const raw = (run!.summary as Record<string, unknown>)?.[key];
      const value = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(value)) {
        rows.push([xIdx, yIdx, value]);
      }
    });
  });
  return rows;
});

function goBack() {
  router.push(`/projects/${projectId.value}/runs`);
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <LButton quaternary size="sm" @click="goBack">
        <ArrowLeft class="mr-1 h-4 w-4" />
        Back
      </LButton>
      <h1 class="text-xl font-semibold">Run Comparison</h1>
    </div>

    <QueryBoundary
      :is-error="isError"
      :error="error"
      title="Couldn't load comparison"
      @retry="() => {}"
    >
      <div v-if="runIds.length < 2" class="py-8">
        <LEmpty
          title="Select runs to compare"
          description="Go back to the runs list and select at least two runs."
        />
      </div>

      <div v-else-if="isLoading" class="space-y-4">
        <LSkeleton class="h-32" />
        <LSkeleton class="h-64" />
      </div>

      <div v-else class="space-y-4">
        <!-- Run summary strip -->
        <LCard class="p-4">
          <div class="mb-3 text-sm font-medium text-fg-secondary">Runs</div>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="run in orderedRuns"
              :key="run!.runId"
              class="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <span
                class="inline-block h-3 w-3 rounded-sm"
                :style="{ backgroundColor: colorForRunId(run!.runId) }"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">
                  <RouterLink
                    :to="`/projects/${projectId}/runs/${run!.runId}`"
                    class="hover:underline"
                  >
                    {{ run!.name }}
                  </RouterLink>
                </div>
                <div class="flex items-center gap-2 text-xs text-fg-tertiary">
                  <RunStatusBadge :status="run!.status" />
                  <span>{{ formatDate(run!.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </LCard>

        <LTabs v-model:value="activeTab">
          <LTabPane name="metrics" tab="Metrics">
            <div v-if="commonMetricKeys.length === 0" class="py-8">
              <LEmpty
                title="No common metrics"
                description="The selected runs do not share any metric keys."
              />
            </div>
            <div v-else class="grid gap-4 xl:grid-cols-2">
              <LCard
                v-for="key in commonMetricKeys"
                :key="key"
                class="p-4"
              >
                <MetricChart
                  :metrics="chartMetricsByKey[key] ?? {}"
                  :title="key"
                  height="300px"
                />
              </LCard>
            </div>
          </LTabPane>

          <LTabPane name="config" tab="Config">
            <LCard class="overflow-x-auto p-0">
              <table class="w-full text-sm">
                <thead class="bg-canvas-muted text-left text-fg-secondary">
                  <tr>
                    <th class="px-4 py-2 font-medium">Key</th>
                    <th
                      v-for="run in orderedRuns"
                      :key="run!.runId"
                      class="px-4 py-2 font-medium"
                    >
                      {{ run!.name }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="key in configKeys"
                    :key="key"
                    class="border-t border-border"
                  >
                    <td class="px-4 py-2 font-mono text-xs">{{ key }}</td>
                    <td
                      v-for="run in orderedRuns"
                      :key="run!.runId"
                      class="px-4 py-2"
                    >
                      {{ (run!.config as Record<string, unknown>)?.[key] ?? "—" }}
                    </td>
                  </tr>
                  <tr v-if="configKeys.length === 0">
                    <td :colspan="orderedRuns.length + 1" class="px-4 py-8 text-center text-fg-tertiary">
                      No config recorded.
                    </td>
                  </tr>
                </tbody>
              </table>
            </LCard>
          </LTabPane>

          <LTabPane name="summary" tab="Summary">
            <LCard class="overflow-x-auto p-0">
              <table class="w-full text-sm">
                <thead class="bg-canvas-muted text-left text-fg-secondary">
                  <tr>
                    <th class="px-4 py-2 font-medium">Key</th>
                    <th
                      v-for="run in orderedRuns"
                      :key="run!.runId"
                      class="px-4 py-2 font-medium"
                    >
                      {{ run!.name }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="key in summaryKeys"
                    :key="key"
                    class="border-t border-border"
                  >
                    <td class="px-4 py-2 font-mono text-xs">{{ key }}</td>
                    <td
                      v-for="run in orderedRuns"
                      :key="run!.runId"
                      class="px-4 py-2"
                    >
                      {{ (run!.summary as Record<string, unknown>)?.[key] ?? "—" }}
                    </td>
                  </tr>
                  <tr v-if="summaryKeys.length === 0">
                    <td :colspan="orderedRuns.length + 1" class="px-4 py-8 text-center text-fg-tertiary">
                      No summary recorded.
                    </td>
                  </tr>
                </tbody>
              </table>
            </LCard>
          </LTabPane>

          <LTabPane name="parallel" tab="Parallel">
            <div v-if="!hasParallelData" class="py-8">
              <LEmpty
                title="No numeric dimensions"
                description="Parallel coordinates need numeric summary or config values."
              />
            </div>
            <LCard v-else class="p-4">
              <LParallelChart
                title="Run dimensions"
                :axes="parallelAxes"
                :rows="parallelRows"
                height="420px"
              />
            </LCard>
          </LTabPane>

          <LTabPane name="heatmap" tab="Heatmap">
            <div v-if="heatmapData.length === 0" class="py-8">
              <LEmpty
                title="No numeric summary data"
                description="Heatmap needs numeric summary values to compare across runs."
              />
            </div>
            <LCard v-else class="p-4">
              <LHeatmapChart
                title="Summary values by run"
                :x-labels="numericSummaryKeys"
                :y-labels="orderedRuns.map((r) => r!.name)"
                :data="heatmapData"
                height="420px"
              />
            </LCard>
          </LTabPane>
        </LTabs>
      </div>
    </QueryBoundary>
  </div>
</template>
