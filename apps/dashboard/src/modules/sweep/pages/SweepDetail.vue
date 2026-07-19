<script setup lang="ts">
import { computed, h, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import {
  LCard,
  LTag,
  LButton,
  LSkeleton,
  LEmpty,
  LDataTable,
  LDialog,
  LSelect,
  LInput,
} from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import {
  ArrowLeft,
  Pause,
  Play,
  Square,
  Sparkles,
  Crown,
} from "lucide-vue-next";
import { useSweep } from "@/modules/sweep/composables/useSweeps";
import { RunService } from "@/services/run.service";
import { SweepService } from "@/services/sweep.service";
import { useToast } from "@/composables/useToast";
import { useDateFormat } from "@/composables/useDateFormat";
import RunStatusBadge from "@/widgets/run-status-badge/RunStatusBadge.vue";
import type { Run } from "@/types/run";
import type { SweepState } from "@/types/sweep";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const sweepId = computed(() => route.params.sweepId as string);
const { formatDate, formatDurationMs } = useDateFormat();
const toast = useToast();
const queryClient = useQueryClient();

const { data: sweep, isLoading } = useSweep(sweepId);

// Runs belonging to this sweep. Backend doesn't expose ?sweepId= filter
// yet, so we fetch the project's runs and filter client-side. Mark as
// stale via queryKey so updates (state transitions) refetch it.
const { data: sweepRuns } = useQuery({
  queryKey: computed(() => ["sweep-runs", projectId.value, sweepId.value]),
  queryFn: async () => {
    if (!projectId.value) return [] as Run[];
    const resp = await RunService.list({
      project: undefined,
      limit: 200,
      offset: 0,
    });
    return resp.items.filter((r) => r.sweepId === sweepId.value);
  },
  enabled: computed(() => !!projectId.value),
});

const { data: observations } = useQuery({
  queryKey: computed(() => ["sweep-observations", sweepId.value]),
  queryFn: () => SweepService.listObservations(sweepId.value),
  enabled: computed(() => !!sweepId.value),
});

const totalRuns = computed(() => sweepRuns.value?.length ?? 0);

const sweepMetric = computed<{ name: string; goal?: string } | null>(() => {
  const cfg = sweep.value?.config as
    | { metric?: { name?: string; goal?: string } }
    | undefined;
  if (!cfg?.metric?.name) return null;
  return { name: cfg.metric.name, goal: cfg.metric.goal };
});

// ── State transitions (Pause / Resume / Stop) ────────────────────────
const stateMutation = useMutation({
  mutationFn: (state: SweepState) =>
    SweepService.update(sweepId.value, { state }),
  onSuccess: (_, state) => {
    toast.success(`Sweep ${state}`);
    queryClient.invalidateQueries({ queryKey: ["sweep", sweepId.value] });
    queryClient.invalidateQueries({ queryKey: ["sweep-runs", projectId.value, sweepId.value] });
  },
  onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
});

function pause() {
  if (!sweep.value) return;
  if (!window.confirm("Pause this sweep? Pending runs will keep going but no new trials will start.")) return;
  stateMutation.mutate("cancelled");
}
function resume() {
  if (!sweep.value) return;
  stateMutation.mutate("running");
}
function stop() {
  if (!sweep.value) return;
  if (!window.confirm("Stop this sweep permanently? This sets state to 'cancelled' and is irreversible.")) return;
  stateMutation.mutate("cancelled");
}

// ── Suggest next run ─────────────────────────────────────────────────
const suggestOpen = ref(false);
const suggestData = ref<Array<Record<string, unknown>> | null>(null);
const suggestError = ref<string | null>(null);
const suggestMutation = useMutation({
  mutationFn: () => SweepService.suggest(sweepId.value),
  onSuccess: (resp) => {
    suggestData.value = resp.candidates;
    suggestError.value = null;
    suggestOpen.value = true;
  },
  onError: (e) => {
    suggestError.value = (e as Error).message;
    toast.error(`Suggest failed: ${(e as Error).message}`);
  },
});

// ── Record best run ──────────────────────────────────────────────────
const recordOpen = ref(false);
const recordRunId = ref<string | null>(null);
const recordMetric = ref<string>("");
const recordError = ref<string | null>(null);

const runOptions = computed(() =>
  (sweepRuns.value ?? [])
    .filter((r) => r.status === "finished")
    .map((r) => ({
      label: `${r.name}  (${r.runId.slice(0, 8)}…)`,
      value: r.runId,
    })),
);

const recordMutation = useMutation({
  mutationFn: () => {
    if (!recordRunId.value) throw new Error("Pick a run");
    const metric = Number(recordMetric.value);
    if (Number.isNaN(metric)) throw new Error("Metric must be a number");
    return SweepService.recordBestRun(sweepId.value, {
      runId: recordRunId.value,
      metric,
      goal: (sweep.value?.config as { metric?: { goal?: string } } | undefined)?.metric?.goal,
    });
  },
  onSuccess: () => {
    toast.success("Best run updated");
    recordOpen.value = false;
    recordRunId.value = null;
    recordMetric.value = "";
    queryClient.invalidateQueries({ queryKey: ["sweep", sweepId.value] });
  },
  onError: (e) => {
    const msg = (e as Error).message;
    recordError.value = msg;
    toast.error(`Failed: ${msg}`);
  },
});

const columns: ColumnDef<Run>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => h(RunStatusBadge, { status: row.original.status }),
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/runs/${row.original.runId}`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => {
      if (!row.original.finishedAt) return "—";
      return formatDurationMs(
        new Date(row.original.finishedAt).getTime() -
          new Date(row.original.createdAt).getTime(),
      );
    },
  },
];
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      :to="`/projects/${projectId}/sweeps`"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to sweeps
    </RouterLink>

    <LSkeleton v-if="isLoading" text :repeat="3" />

    <template v-else-if="sweep">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">{{ sweep.name }}</h1>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-fg-tertiary">
            <LTag
              size="small"
              :type="
                sweep.state === 'running'
                  ? 'warning'
                  : sweep.state === 'finished'
                    ? 'success'
                    : sweep.state === 'crashed' || sweep.state === 'cancelled'
                      ? 'error'
                      : 'default'
              "
            >
              {{ sweep.state }}
            </LTag>
            <LTag size="small" type="info">{{ sweep.method }}</LTag>
            <span>{{ totalRuns }} runs</span>
            <span>{{ observations?.length ?? 0 }} observations</span>
            <span>Created {{ formatDate(sweep.createdAt) }}</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <LButton
            size="sm"
            quaternary
            :disabled="sweep.state !== 'running' || stateMutation.isPending.value"
            @click="pause"
          >
            <Pause class="mr-1 h-3 w-3" />
            Pause
          </LButton>
          <LButton
            size="sm"
            quaternary
            :disabled="sweep.state === 'running' || stateMutation.isPending.value"
            @click="resume"
          >
            <Play class="mr-1 h-3 w-3" />
            Resume
          </LButton>
          <LButton
            size="sm"
            quaternary
            :disabled="sweep.state === 'finished' || sweep.state === 'cancelled' || stateMutation.isPending.value"
            @click="stop"
          >
            <Square class="mr-1 h-3 w-3" />
            Stop
          </LButton>
          <LButton
            size="sm"
            quaternary
            :loading="suggestMutation.isPending.value"
            @click="suggestMutation.mutate()"
          >
            <Sparkles class="mr-1 h-3 w-3" />
            Suggest next
          </LButton>
          <LButton
            size="sm"
            @click="recordOpen = true"
            :disabled="(sweepRuns ?? []).filter((r) => r.status === 'finished').length === 0"
          >
            <Crown class="mr-1 h-3 w-3" />
            Record best
          </LButton>
        </div>
      </div>

      <LCard title="Sweep overview" class="p-4">
        <div class="grid gap-3 sm:grid-cols-4">
          <div class="rounded-md border border-border p-3">
            <div class="text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
              Method
            </div>
            <div class="mt-1 font-mono text-sm">{{ sweep.method }}</div>
          </div>
          <div class="rounded-md border border-border p-3">
            <div class="text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
              Best Run
            </div>
            <div class="mt-1 font-mono text-sm">
              <RouterLink
                v-if="sweep.bestRunId"
                :to="`/projects/${projectId}/runs/${sweep.bestRunId}`"
                class="hover:underline"
              >
                {{ sweep.bestRunId.slice(0, 12) }}…
              </RouterLink>
              <span v-else>—</span>
            </div>
          </div>
          <div class="rounded-md border border-border p-3">
            <div class="text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
              Total Runs
            </div>
            <div class="mt-1 font-mono text-sm">{{ totalRuns }}</div>
          </div>
          <div class="rounded-md border border-border p-3">
            <div class="text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
              Metric
            </div>
            <div class="mt-1 font-mono text-sm">
              <template v-if="sweepMetric">
                {{ sweepMetric.name }}
                <span class="text-xs text-fg-tertiary">({{ sweepMetric.goal }})</span>
              </template>
              <span v-else>—</span>
            </div>
          </div>
        </div>
      </LCard>

      <LCard title="Runs" class="p-0">
        <LDataTable
          v-if="sweepRuns && sweepRuns.length > 0"
          :data="sweepRuns"
          :columns="columns"
        />
        <div v-else class="p-8">
          <LEmpty
            title="No runs yet"
            description="This sweep hasn't produced any runs yet."
          />
        </div>
      </LCard>

      <LCard title="Config" class="p-4">
        <pre class="overflow-auto rounded-md bg-canvas p-3 font-mono text-xs">{{ JSON.stringify(sweep.config, null, 2) }}</pre>
      </LCard>

      <!-- ── Suggest dialog ──────────────────────────────────────────── -->
      <LDialog
        v-model:show="suggestOpen"
        title="Next trial parameters"
        width="540px"
      >
        <div class="space-y-3">
          <p class="text-xs text-fg-tertiary">
            Server-side optimizer suggestions. Pass the params to
            <code class="font-mono">lumina.init(sweep="…", config=…)</code>
            when starting the next run.
          </p>
          <pre v-if="suggestData" class="overflow-auto rounded-md bg-canvas p-3 font-mono text-xs">{{ JSON.stringify(suggestData, null, 2) }}</pre>
        </div>
        <template #footer>
          <div class="flex justify-end">
            <LButton @click="suggestOpen = false">Close</LButton>
          </div>
        </template>
      </LDialog>

      <!-- ── Record best dialog ──────────────────────────────────────── -->
      <LDialog
        v-model:show="recordOpen"
        title="Record best run"
        width="500px"
        @close="recordError = null"
      >
        <div class="space-y-3">
          <p class="text-xs text-fg-tertiary">
            Pick the run that currently holds the best observed value for the
            sweep's metric, and enter the metric value. The sweep's
            <code class="font-mono">bestRunId</code> will be updated.
          </p>
          <div>
            <label class="mb-1 block text-xs font-medium text-fg-secondary">
              Run <span class="text-accent-danger">*</span>
            </label>
            <LSelect
              v-model:value="recordRunId"
              :options="runOptions"
              placeholder="Pick a finished run"
              style="width: 100%"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-fg-secondary">
              Metric value <span class="text-accent-danger">*</span>
            </label>
            <LInput
              v-model:value="recordMetric"
              placeholder="e.g. 0.012"
            />
          </div>
          <div
            v-if="recordError"
            class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
          >
            {{ recordError }}
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <LButton quaternary @click="recordOpen = false">Cancel</LButton>
            <LButton
              :loading="recordMutation.isPending.value"
              :disabled="!recordRunId || !recordMetric"
              @click="recordMutation.mutate()"
            >
              Save
            </LButton>
          </div>
        </template>
      </LDialog>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Sweep not found.
    </LCard>
  </div>
</template>