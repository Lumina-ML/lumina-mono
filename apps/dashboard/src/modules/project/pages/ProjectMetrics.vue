<script setup lang="ts">
import { computed, h, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { LCard, LDataTable, LTag, LEmpty, LInput, LSkeleton } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { Activity, Search } from "lucide-vue-next";
import { useRuns } from "@/modules/run/composables/useRuns";
import { MetricService } from "@/services/metric.service";
import { useDateFormat } from "@/composables/useDateFormat";
import type { MetricPoint } from "@/types/metric";
import type { Run } from "@/types/run";

/**
 * Project-scoped metrics browser.
 *
 * For each unique (run × metricKey) tuple in the project, shows the last
 * value, a tiny inline sparkline from the latest 100 points, and a jump
 * link to the run's Metrics tab on RunDetail.
 *
 * Data flow:
 *   1. `useRuns({ projectId, limit: 50 })` — recent runs in the project
 *   2. `MetricService.compare({ runIds })` — single batched fetch for all
 *      runs' metric series (max 100 points each — fine for sparklines)
 *   3. Group by metricKey across runs, render as a flat list
 *
 * Why a 50-run cap: at this page granularity, only the most recent runs
 * are useful for "what's my loss doing right now?". The full history lives
 * on RunDetail and in the Runs tab pagination.
 */
const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const { formatDate } = useDateFormat();
const RUNS_PER_PAGE = 50;
const POINTS_PER_METRIC = 100;

const search = ref("");

const { data: runsResponse, isLoading: runsLoading } = useRuns(
  computed(() => ({
    projectId: projectId.value,
    limit: RUNS_PER_PAGE,
    offset: 0,
  })),
);

const runs = computed<Run[]>(() => runsResponse.value?.items ?? []);
const runIds = computed(() => runs.value.map((r) => r.runId));

const { data: compareData, isLoading: compareLoading } = useQuery({
  queryKey: computed(() => ["compareMetrics", projectId.value, runIds.value]),
  queryFn: () =>
    MetricService.compare({
      runIds: runIds.value,
      limit: POINTS_PER_METRIC,
    }),
  enabled: computed(() => runIds.value.length > 0),
});

interface MetricSummary {
  key: string;
  runId: string;
  runName: string;
  lastValue: number;
  lastStep: number;
  loggedAt: string;
  points: MetricPoint[];
}

/**
 * Flatten the compare payload into one row per (run × key). Runs that
 * haven't logged the metric in the fetched series are skipped. Sort by
 * metricKey asc, then by runName asc, so the list is stable as users
 * type in the search box.
 */
const allSummaries = computed<MetricSummary[]>(() => {
  const runsById = new Map(runs.value.map((r) => [r.runId, r]));
  const out: MetricSummary[] = [];
  const payload = compareData.value?.runs ?? [];
  for (const runEntry of payload) {
    const r = runsById.get(runEntry.runId);
    const runName = r?.name ?? runEntry.runId;
    for (const [key, points] of Object.entries(runEntry.metrics)) {
      if (!points || points.length === 0) continue;
      const last = points[points.length - 1]!;
      out.push({
        key,
        runId: runEntry.runId,
        runName,
        lastValue: last.value,
        lastStep: last.step,
        loggedAt: last.loggedAt,
        points,
      });
    }
  }
  out.sort((a, b) => {
    if (a.key !== b.key) return a.key.localeCompare(b.key);
    return a.runName.localeCompare(b.runName);
  });
  return out;
});

const filteredSummaries = computed<MetricSummary[]>(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return allSummaries.value;
  return allSummaries.value.filter(
    (s) => s.key.toLowerCase().includes(q) || s.runName.toLowerCase().includes(q),
  );
});

const uniqueKeyCount = computed(() => new Set(allSummaries.value.map((s) => s.key)).size);
const totalRunCount = computed(() => new Set(allSummaries.value.map((s) => s.runId)).size);
const isLoading = computed(() => runsLoading.value || compareLoading.value);

const columns: ColumnDef<MetricSummary>[] = [
  {
    id: "sparkline",
    header: "",
    cell: ({ row }) => h(Sparkline, { points: row.original.points }),
    size: 80,
  },
  {
    accessorKey: "key",
    header: "Metric",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${projectId.value}/runs/${row.original.runId}#metrics`,
          class: "font-mono text-sm hover:underline",
        },
        () => row.original.key,
      ),
  },
  {
    accessorKey: "runName",
    header: "Run",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${projectId.value}/runs/${row.original.runId}`,
          class: "hover:underline",
        },
        () => row.original.runName,
      ),
  },
  {
    accessorKey: "lastValue",
    header: "Last value",
    cell: ({ row }) =>
      h("span", { class: "font-mono text-sm" }, formatValue(row.original.lastValue)),
  },
  {
    accessorKey: "lastStep",
    header: "Step",
    cell: ({ row }) => h("span", { class: "font-mono text-xs" }, String(row.original.lastStep)),
  },
  {
    accessorKey: "loggedAt",
    header: "Logged",
    cell: ({ row }) =>
      h(
        "span",
        { class: "text-xs text-fg-tertiary" },
        formatDate(row.original.loggedAt),
      ),
  },
];

function Sparkline(props: { points: MetricPoint[] }) {
  // Tiny SVG path of the last values. Sized to fit the LDataTable cell.
  const PAD = 2;
  const W = 64;
  const H = 20;
  const pts = props.points;
  if (pts.length < 2) {
    return h("span", { class: "font-mono text-xs text-fg-tertiary" }, "—");
  }
  const ys = pts.map((p) => p.value);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;
  const step = (W - PAD * 2) / (pts.length - 1);
  const d = pts
    .map((p, i) => {
      const x = PAD + i * step;
      const y = H - PAD - ((p.value - min) / range) * (H - PAD * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return h(
    "svg",
    {
      width: W,
      height: H,
      viewBox: `0 0 ${W} ${H}`,
      class: "text-accent-primary",
      "aria-hidden": "true",
    },
    [
      h("path", {
        d,
        fill: "none",
        stroke: "currentColor",
        "stroke-width": 1.5,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
    ],
  );
}

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (Math.abs(v) >= 1000 || (Math.abs(v) > 0 && Math.abs(v) < 0.01)) {
    return v.toExponential(2);
  }
  return Number(v.toFixed(4)).toString();
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wider text-fg-tertiary">
          Metrics browser
        </h2>
        <p class="mt-1 text-xs text-fg-tertiary">
          {{ isLoading ? "Loading…" : `${uniqueKeyCount} unique keys across ${totalRunCount} runs` }}
        </p>
      </div>
      <div class="relative min-w-[240px]">
        <Search
          class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-tertiary"
        />
        <LInput
          v-model:value="search"
          placeholder="Filter metric or run…"
          class="!pl-9"
        />
      </div>
    </div>

    <LCard class="p-0">
      <div v-if="isLoading" class="space-y-3 p-6">
        <LSkeleton :repeat="6" text />
      </div>
      <LDataTable
        v-else
        :data="filteredSummaries"
        :columns="columns"
        :loading="false"
      />
      <div
        v-if="!isLoading && allSummaries.length === 0"
        class="px-6 pb-6"
      >
        <LEmpty
          title="No metrics yet"
          description="Logged metric series appear here once runs emit them via the SDK."
        >
          <RouterLink :to="`/projects/${projectId}/runs`">
            <LTag class="mt-2 cursor-pointer">
              <Activity class="mr-1 inline h-3 w-3" />
              Open Runs
            </LTag>
          </RouterLink>
        </LEmpty>
      </div>
      <div
        v-else-if="!isLoading && filteredSummaries.length === 0"
        class="px-6 pb-6"
      >
        <LEmpty
          title="No matches"
          :description="`No metric or run names match “${search}”.`"
        />
      </div>
    </LCard>
  </div>
</template>
