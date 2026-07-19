<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { RouterLink } from "vue-router";
import { ChartRenderer } from "@lumina/ui";
import type { ChartConfig } from "@lumina/ui";
import {
  LCard,
  LTag,
  LSkeleton,
  LEmpty,
  LInput,
  LSelect,
  LStatusBadge,
  LTooltip,
} from "@lumina/ui";
import {
  Activity,
  Cpu,
  Server,
  Search,
  Wifi,
  WifiOff,
} from "lucide-vue-next";
import { RunService } from "@/services/run.service";
import { SystemMetricService } from "@/services/system-metric.service";
import { useProjects } from "@/modules/project/composables/useProjects";
import { useDateFormat } from "@/composables/useDateFormat";
import { useCurrentProject } from "@/composables/useCurrentProject";
import { useRealtimeSubscription } from "@/composables/useRealtimeSubscription";
import { useProjectStore } from "@/stores/project";
import type { Run } from "@/types/run";

const { formatDate } = useDateFormat();
const queryClient = useQueryClient();
const projectStore = useProjectStore();

// `useCurrentProject` returns a Ref<string | undefined> — it picks up
// the project from the route or the persisted store. We layer a local
// selector on top so the user can flip projects explicitly here
// without navigating into a project first.
const routeProjectId = useCurrentProject();
const selectedProjectId = computed<string | null>({
  get: () => routeProjectId.value ?? projectStore.currentId ?? null,
  set: (id) => {
    projectStore.setCurrentId(id);
  },
});

// LSelect doesn't accept null as a value — translate between the store's
// nullable representation and the option's "" sentinel for "all projects".
const selectedProjectOption = computed({
  get: () => selectedProjectId.value ?? "",
  set: (v: string) => {
    selectedProjectId.value = v === "" ? null : v;
  },
});

const { data: projects } = useProjects();
const projectOptions = computed(() => [
  { label: "All projects", value: "" },
  ...(projects.value?.items ?? []).map((p) => ({
    label: p.name,
    value: p.id,
  })),
]);

const search = ref("");
const statusFilter = ref<string | null>(null);

const queryKey = computed(() => [
  "monitoring",
  "recent-runs",
  selectedProjectId.value ?? "all",
]);

// ── Pull recent runs (scoped to current project if set) ──────────────
const { data: runsResp, isLoading: runsLoading } = useQuery({
  queryKey,
  queryFn: () => {
    if (!selectedProjectId.value) {
      return RunService.list({ limit: 50, offset: 0 });
    }
    // The list endpoint accepts `project` by name; for an id we go via
    // the project's name. If we only have an id, look it up via
    // ProjectService.get first.
    const project = projects.value?.items.find(
      (p) => p.id === selectedProjectId.value,
    );
    return RunService.list({
      limit: 50,
      offset: 0,
      ...(project ? { project: project.name } : {}),
    });
  },
});

const recentRuns = computed<Run[]>(() => runsResp.value?.items ?? []);

// ── Live updates via WebSocket ────────────────────────────────────────
// We listen on workspace:default (the same channel AppLayout subscribes
// to) and refetch the recent-runs query on any run lifecycle event so
// the counter / status distribution / noisy list update without a hard
// refresh. RunFinished/RunCreated also touch the cross-module tables
// (evaluations, sweeps, launch queues) — invalidate them so the
// navigation away from this page doesn't show stale counts.
const { status: wsStatus } = useRealtimeSubscription(
  computed(() => "workspace:default"),
  (event) => {
    if (event.type === "RunFinished" || event.type === "RunCreated") {
      queryClient.invalidateQueries({ queryKey: ["monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      queryClient.invalidateQueries({ queryKey: ["sweeps"] });
      queryClient.invalidateQueries({ queryKey: ["launch-queues"] });
      queryClient.invalidateQueries({ queryKey: ["launch-runs"] });
    }
  },
);

// ── Aggregate: status breakdown + failure rate ────────────────────────
const statusCounts = computed(() => {
  const out: Record<string, number> = {};
  for (const r of recentRuns.value) out[r.status] = (out[r.status] ?? 0) + 1;
  return out;
});

const totalRuns = computed(() => recentRuns.value.length);
const failureRate = computed(() => {
  const failed = (statusCounts.value.failed ?? 0) + (statusCounts.value.crashed ?? 0);
  return totalRuns.value === 0 ? 0 : failed / totalRuns.value;
});

// ── Per-project rollup ───────────────────────────────────────────────
const projectRollup = computed(() => {
  const map = new Map<string, { projectId: string; count: number; failed: number; running: number }>();
  for (const r of recentRuns.value) {
    const e = map.get(r.projectId) ?? {
      projectId: r.projectId,
      count: 0,
      failed: 0,
      running: 0,
    };
    e.count += 1;
    if (r.status === "failed" || r.status === "crashed") e.failed += 1;
    if (r.status === "running") e.running += 1;
    map.set(r.projectId, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
});

// ── Status distribution chart ─────────────────────────────────────────
const statusChart = computed<ChartConfig>(() => ({
  title: "Status distribution (last 50 runs)",
  xAxis: {
    type: "category",
    data: Object.keys(statusCounts.value),
  },
  yAxis: {
    type: "value",
    name: "Runs",
  },
  legend: { show: false },
  tooltip: { trigger: "axis" },
  series: [
    {
      type: "bar",
      name: "Runs",
      data: Object.entries(statusCounts.value).map(
        ([label, value]) => [label, value] as [string, number],
      ),
      color: "#3b82f6",
    },
  ],
}));

// ── Noisy runs (top failure rate) ────────────────────────────────────
const noisyRuns = computed(() =>
  recentRuns.value
    .filter((r) => r.status === "failed" || r.status === "crashed")
    .slice(0, 8),
);

// ── Aggregate system metrics across recent runs ──────────────────────
const systemStats = useQuery({
  queryKey: computed(() => [
    "monitoring",
    "system-stats",
    recentRuns.value.slice(0, 8).map((r) => r.runId).join(","),
  ]),
  queryFn: async () => {
    const samples = recentRuns.value.slice(0, 8);
    const results = await Promise.all(
      samples.map(async (r) => {
        try {
          const resp = await SystemMetricService.list(r.runId, { limit: 500 });
          return resp.metrics;
        } catch {
          return {};
        }
      }),
    );
    // Average each metric key across runs that have data.
    const sums: Record<string, { sum: number; count: number }> = {};
    for (const m of results) {
      for (const [k, points] of Object.entries(m)) {
        if (!Array.isArray(points) || points.length === 0) continue;
        const avg = points.reduce((a, p) => a + p.value, 0) / points.length;
        if (!sums[k]) sums[k] = { sum: 0, count: 0 };
        sums[k]!.sum += avg;
        sums[k]!.count += 1;
      }
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(sums)) {
      out[k] = v.count === 0 ? 0 : v.sum / v.count;
    }
    return out;
  },
});

const gpuUtilAvg = computed(() => {
  const candidates = ["gpu/util", "gpu.util", "gpu_utilization"];
  for (const k of candidates) {
    const v = systemStats.data.value?.[k];
    if (typeof v === "number") return v;
  }
  return null;
});
const cpuAvg = computed(() => {
  const candidates = ["cpu/util", "cpu.util", "cpu_usage"];
  for (const k of candidates) {
    const v = systemStats.data.value?.[k];
    if (typeof v === "number") return v;
  }
  return null;
});
const memAvg = computed(() => {
  // SDK writes memory in MiB; render as GB so the card matches the
  // rest of the monitoring stats.
  const candidates = ["memory/used", "memory.used", "mem_used", "memory.used_mb"];
  for (const k of candidates) {
    const v = systemStats.data.value?.[k];
    if (typeof v === "number") {
      return k.endsWith("_mb") ? v / 1024 : v;
    }
  }
  return null;
});

const statusOptions = [
  { label: "All", value: "" },
  { label: "Running", value: "running" },
  { label: "Finished", value: "finished" },
  { label: "Failed", value: "failed" },
  { label: "Crashed", value: "crashed" },
  { label: "Preempting", value: "preempting" },
];

const filteredRuns = computed(() => {
  const q = search.value.trim().toLowerCase();
  return recentRuns.value.filter((r) => {
    if (statusFilter.value && r.status !== statusFilter.value) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) || r.runId.toLowerCase().includes(q)
    );
  });
});
</script>

<template>
  <div class="space-y-6">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2">
      <LSelect
        v-model:value="selectedProjectOption"
        :options="projectOptions"
        placeholder="All projects"
        style="width: 220px"
        clearable
      />
      <LInput v-model:value="search" size="small" placeholder="Search runs…" style="width: 240px">
        <template #prefix>
          <Search class="h-3.5 w-3.5 text-fg-tertiary" />
        </template>
      </LInput>
      <LSelect
        v-model:value="statusFilter"
        :options="statusOptions"
        placeholder="Filter status"
        clearable
        style="width: 160px"
      />
      <LTooltip
        :content="
          wsStatus === 'open'
            ? 'Live updates via WebSocket'
            : wsStatus === 'connecting'
              ? 'Connecting…'
              : 'WebSocket offline — refresh manually'
        "
      >
        <span
          :class="[
            'flex h-7 w-7 items-center justify-center rounded-full',
            wsStatus === 'open'
              ? 'bg-accent-success/15 text-accent-success'
              : wsStatus === 'connecting'
                ? 'bg-accent-warning/15 text-accent-warning'
                : 'bg-canvas text-fg-tertiary',
          ]"
          :aria-label="`WebSocket status: ${wsStatus}`"
        >
          <Wifi v-if="wsStatus === 'open'" class="h-3.5 w-3.5" />
          <WifiOff v-else class="h-3.5 w-3.5" />
        </span>
      </LTooltip>
    </div>

    <!-- Aggregate stats -->
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <LCard class="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs font-medium uppercase text-fg-tertiary">Total runs</div>
            <div class="mt-2 font-mono text-2xl">{{ totalRuns }}</div>
          </div>
          <Activity class="h-5 w-5 text-fg-tertiary" />
        </div>
      </LCard>
      <LCard class="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs font-medium uppercase text-fg-tertiary">Failure rate</div>
            <div class="mt-2 font-mono text-2xl">{{ (failureRate * 100).toFixed(1) }}%</div>
          </div>
          <LTag :type="failureRate > 0.2 ? 'error' : 'success'" size="small">
            {{ failureRate > 0.2 ? "High" : "Healthy" }}
          </LTag>
        </div>
      </LCard>
      <LCard class="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs font-medium uppercase text-fg-tertiary">Avg GPU util</div>
            <div class="mt-2 font-mono text-2xl">
              {{ gpuUtilAvg == null ? "—" : `${gpuUtilAvg.toFixed(1)}%` }}
            </div>
          </div>
          <Server class="h-5 w-5 text-fg-tertiary" />
        </div>
      </LCard>
      <LCard class="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs font-medium uppercase text-fg-tertiary">Avg CPU util</div>
            <div class="mt-2 font-mono text-2xl">
              {{ cpuAvg == null ? "—" : `${cpuAvg.toFixed(1)}%` }}
            </div>
          </div>
          <Cpu class="h-5 w-5 text-fg-tertiary" />
        </div>
      </LCard>
      <LCard class="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs font-medium uppercase text-fg-tertiary">Avg memory used</div>
            <div class="mt-2 font-mono text-2xl">
              {{ memAvg == null ? "—" : `${memAvg.toFixed(2)} GB` }}
            </div>
          </div>
          <Server class="h-5 w-5 text-fg-tertiary" />
        </div>
      </LCard>
    </div>

    <!-- Status distribution -->
    <LCard class="p-4">
      <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
        Status distribution
      </h3>
      <ChartRenderer :config="statusChart" :height="'260'" />
    </LCard>

    <div class="grid gap-4 lg:grid-cols-2">
      <!-- Per-project rollup -->
      <LCard class="p-0">
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 class="text-sm font-medium">By project</h3>
          <span class="font-mono text-xs text-fg-tertiary">
            {{ projectRollup.length }} project(s)
          </span>
        </div>
        <LSkeleton v-if="runsLoading" class="p-4" :repeat="3" />
        <ul v-else-if="projectRollup.length > 0" class="divide-y divide-border">
          <li
            v-for="row in projectRollup"
            :key="row.projectId"
            class="flex items-center justify-between px-4 py-2 text-sm"
          >
            <RouterLink
              :to="`/projects/${row.projectId}`"
              class="font-mono text-xs hover:underline"
            >
              {{ row.projectId.slice(0, 12) }}
            </RouterLink>
            <div class="flex items-center gap-3 font-mono text-xs">
              <span class="text-fg-tertiary">{{ row.count }} runs</span>
              <span v-if="row.running > 0" class="text-accent-info">
                {{ row.running }} running
              </span>
              <span v-if="row.failed > 0" class="text-accent-danger">
                {{ row.failed }} failed
              </span>
            </div>
          </li>
        </ul>
        <LEmpty
          v-else
          class="p-8"
          title="No runs yet"
          description="Run data will populate as soon as a project starts logging runs."
        />
      </LCard>

      <!-- Noisy runs -->
      <LCard class="p-0">
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 class="text-sm font-medium">Noisy runs</h3>
          <span class="font-mono text-xs text-fg-tertiary">
            {{ noisyRuns.length }} failed
          </span>
        </div>
        <LSkeleton v-if="runsLoading" class="p-4" :repeat="3" />
        <ul v-else-if="noisyRuns.length > 0" class="divide-y divide-border">
          <li
            v-for="r in noisyRuns"
            :key="r.runId"
            class="flex items-center justify-between px-4 py-2 text-sm hover:bg-canvas"
          >
            <div class="flex min-w-0 items-center gap-2">
              <LStatusBadge :status="r.status as never" />
              <RouterLink
                :to="`/projects/${r.projectId}/runs/${r.runId}`"
                class="truncate font-medium hover:underline"
              >
                {{ r.name }}
              </RouterLink>
            </div>
            <span class="font-mono text-xs text-fg-tertiary">
              {{ formatDate(r.createdAt) }}
            </span>
          </li>
        </ul>
        <LEmpty
          v-else
          class="p-8"
          title="No failed runs"
          description="Nothing has crashed in the recent window."
        />
      </LCard>
    </div>

    <!-- Recent runs table -->
    <LCard class="p-0">
      <div class="border-b border-border px-4 py-3">
        <h3 class="text-sm font-medium">Recent runs</h3>
      </div>
      <LSkeleton v-if="runsLoading" class="p-4" :repeat="3" />
      <ul v-else-if="filteredRuns.length > 0" class="divide-y divide-border">
        <li
          v-for="r in filteredRuns.slice(0, 20)"
          :key="r.runId"
          class="flex items-center justify-between px-4 py-2 text-sm hover:bg-canvas"
        >
          <div class="flex min-w-0 items-center gap-3">
            <LStatusBadge :status="r.status as never" />
            <RouterLink
              :to="`/projects/${r.projectId}/runs/${r.runId}`"
              class="truncate font-medium hover:underline"
            >
              {{ r.name }}
            </RouterLink>
            <span class="font-mono text-xs text-fg-tertiary">
              {{ r.projectId.slice(0, 12) }}
            </span>
          </div>
          <span class="font-mono text-xs text-fg-tertiary">
            {{ formatDate(r.createdAt) }}
          </span>
        </li>
      </ul>
      <LEmpty
        v-else
        class="p-8"
        title="No runs match these filters"
        description="Adjust the search or status filter."
      />
    </LCard>
  </div>
</template>