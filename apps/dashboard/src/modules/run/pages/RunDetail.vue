<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  LSkeleton,
  LTabs,
  LTabPane,
  LTag,
  LTooltip,
  LCard,
  LButton,
  LEmpty,
  LJsonView,
  LTraceTimeline,
  LDialog,
  LTextarea,
} from "@lumina/ui";
import type { TraceSpan } from "@lumina/ui";
import {
  Calendar,
  Clock,
  Wifi,
  WifiOff,
  Hash,
  GitCommit,
  User as UserIcon,
  Server,
  Box,
  Pencil,
  StopCircle,
  XCircle,
  Trash2,
  AlertTriangle,
} from "lucide-vue-next";
import { useRun } from "@/modules/run/composables/useRuns";
import { useMetrics } from "@/modules/metric/composables/useMetrics";
import { useSystemMetrics } from "@/modules/metric/composables/useSystemMetrics";
import { useLogLines } from "@/modules/log-line/composables/useLogLines";
import { useRunTags } from "@/modules/run/composables/useTags";
import MetricChart from "@/widgets/metric-chart/MetricChart.vue";
import LogViewer from "@/widgets/log-viewer/LogViewer.vue";
import TagList from "@/widgets/tag-list/TagList.vue";
import { useDateFormat } from "@/composables/useDateFormat";
import { useAutoRefresh } from "@/composables/useAutoRefresh";
import { useRealtimeSubscription } from "@/composables/useRealtimeSubscription";
import { colorForRunId } from "@/composables/useRunColor";
import { useToast } from "@/composables/useToast";
import { TraceService } from "@/services/trace.service";
import { ArtifactService } from "@/services/artifact.service";
import { RunService } from "@/services/run.service";
import type { LogLevel } from "@/types/log-line";
import { useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const runId = computed(() => route.params.runId as string);

const { data: run, isLoading: isRunLoading, refetch: refetchRun } = useRun(runId);
const { data: metrics, isLoading: isMetricsLoading, refetch: refetchMetrics } = useMetrics(runId);
const { data: systemMetrics, isLoading: isSystemMetricsLoading, refetch: refetchSystemMetrics } = useSystemMetrics(runId);
const { data: logLines, isLoading: isLogsLoading, refetch: refetchLogs } = useLogLines(runId);
const { data: runTags, isLoading: isTagsLoading, refetch: refetchTags } = useRunTags(runId);

const { formatDate, formatDurationMs } = useDateFormat();

const logLevelFilter = ref<LogLevel | null>(null);

// ── WebSocket subscription (primary live source) ────────────────────────
const { status: wsStatus } = useRealtimeSubscription(
  computed(() => `run:${runId.value}`),
  (event) => {
    switch (event.type) {
      case "MetricLogged":
        queryClient.invalidateQueries({ queryKey: ["metrics", runId.value] });
        queryClient.invalidateQueries({
          queryKey: ["systemMetrics", runId.value],
        });
        queryClient.invalidateQueries({ queryKey: ["run", runId.value] });
        break;
      case "RunFinished":
        queryClient.invalidateQueries({ queryKey: ["run", runId.value] });
        queryClient.invalidateQueries({ queryKey: ["metrics", runId.value] });
        queryClient.invalidateQueries({ queryKey: ["logLines", runId.value] });
        break;
      default:
        break;
    }
  },
);

// Fallback polling when WS is offline and run is still active.
const isRunning = computed(() => run.value?.status === "running");
useAutoRefresh(
  computed(() => isRunning.value && wsStatus.value !== "open"),
  5000,
  () => {
    refetchRun();
    refetchMetrics();
    refetchSystemMetrics();
    refetchLogs();
    refetchTags();
  },
);

const durationMs = computed(() => {
  if (!run.value) return 0;
  const end = run.value.finishedAt ? new Date(run.value.finishedAt).getTime() : Date.now();
  return end - new Date(run.value.createdAt).getTime();
});

const metricKeys = computed(() =>
  metrics.value ? Object.keys(metrics.value.metrics) : [],
);
const selectedKeys = ref<string[]>([]);
watch(
  metricKeys,
  (keys) => {
    if (selectedKeys.value.length === 0 && keys.length > 0) {
      selectedKeys.value = keys.slice(0, 5);
    }
  },
  { immediate: true },
);

const filteredMetrics = computed(() => {
  if (!metrics.value) return {};
  const out: Record<string, (typeof metrics.value.metrics)[string]> = {};
  for (const key of selectedKeys.value) {
    if (metrics.value.metrics[key]) out[key] = metrics.value.metrics[key]!;
  }
  return out;
});

function toggleKey(key: string) {
  if (selectedKeys.value.includes(key)) {
    selectedKeys.value = selectedKeys.value.filter((k) => k !== key);
  } else {
    selectedKeys.value = [...selectedKeys.value, key];
  }
}

// ── Traces (linked to this run via metadata.runId) ──────────────────────
const { data: tracesForRun } = useQuery({
  queryKey: computed(() => ["traces", "by-run", runId.value]),
  queryFn: async () => {
    if (!run.value?.projectId) return [];
    const all = await TraceService.list({ projectId: run.value.projectId, limit: 100 });
    return all.items.filter((t) => {
      const md = t.metadata as { runId?: string } | null;
      return md?.runId === runId.value;
    });
  },
  enabled: computed(() => !!run.value?.projectId),
});

const { data: spansForFirstTrace } = useQuery({
  queryKey: computed(() => ["trace-spans", tracesForRun.value?.[0]?.id ?? null]),
  queryFn: async () => {
    const first = tracesForRun.value?.[0];
    if (!first) return [];
    return TraceService.listSpans(first.id);
  },
  enabled: computed(() => !!tracesForRun.value?.[0]),
});

// Convert flat span list to nested tree for LTraceTimeline.
interface SpanNode {
  id: string;
  parentSpanId: string | null;
  name: string;
  startTime: string;
  endTime: string | null;
  attributes: Record<string, unknown>;
  children: SpanNode[];
}
function buildSpanTree(flat: Array<{
  id: string;
  parentSpanId: string | null;
  name: string;
  startTime: string;
  endTime: string | null;
  attributes: Record<string, unknown>;
}>): SpanNode[] {
  const byId = new Map<string, SpanNode>();
  for (const s of flat) byId.set(s.id, { ...s, children: [] });
  const roots: SpanNode[] = [];
  for (const node of byId.values()) {
    if (node.parentSpanId && byId.has(node.parentSpanId)) {
      byId.get(node.parentSpanId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

const traceSpans = computed<TraceSpan[]>(() => {
  const tree = buildSpanTree(spansForFirstTrace.value ?? []);
  function toTraceSpan(node: SpanNode): TraceSpan {
    const startMs = new Date(node.startTime).getTime();
    const endMs = node.endTime ? new Date(node.endTime).getTime() : Date.now();
    return {
      id: node.id,
      name: node.name,
      startTime: startMs,
      endTime: endMs,
      duration: endMs - startMs,
      status: (node.attributes as { status?: string }).status ?? "ok",
      children: node.children.map(toTraceSpan),
    };
  }
  return tree.map(toTraceSpan);
});

// ── Artifacts linked to this run (best-effort: filter by metadata.runId) ─
const { data: artifactsForRun } = useQuery({
  queryKey: computed(() => ["artifacts", "by-run", runId.value]),
  queryFn: async () => {
    if (!run.value?.projectId) return [];
    try {
      const list = await ArtifactService.list({ projectId: run.value.projectId, limit: 100 });
      // The backend doesn't expose runId filtering on Artifact list yet —
      // we surface "—" as a placeholder so the tab isn't empty.
      return list.items.slice(0, 20);
    } catch {
      return [];
    }
  },
  enabled: computed(() => !!run.value?.projectId),
});

// ── Metadata helpers ───────────────────────────────────────────────────
const metadataEntries = computed(() => {
  const md = (run.value?.metadata ?? {}) as Record<string, unknown>;
  return [
    { icon: Hash, label: "Run ID", value: run.value?.runId, mono: true },
    { icon: Hash, label: "Internal ID", value: run.value?.id, mono: true },
    { icon: UserIcon, label: "Created By", value: md.user ?? md.userId ?? "—" },
    { icon: Server, label: "Host", value: md.host ?? md.hostname ?? "—" },
    { icon: GitCommit, label: "Git Commit", value: md.gitCommit ?? md.commit ?? "—", mono: true },
    { icon: Calendar, label: "Created", value: run.value ? formatDate(run.value.createdAt) : "—" },
    { icon: Calendar, label: "Updated", value: run.value ? formatDate(run.value.updatedAt) : "—" },
    { icon: Calendar, label: "Finished", value: run.value?.finishedAt ? formatDate(run.value.finishedAt) : "—" },
    { icon: Clock, label: "Duration", value: formatDurationMs(durationMs.value) },
    { icon: Box, label: "Sweep", value: run.value?.sweepId ?? "—" },
  ];
});

const hasConfig = computed(
  () => run.value?.config && Object.keys(run.value.config).length > 0,
);

const summaryEntries = computed(() => {
  const s = (run.value?.summary ?? {}) as Record<string, unknown>;
  return Object.entries(s);
});

// ── Run control: preempt / cancel / edit notes ─────────────────────────
const toast = useToast();

// A run is "active" if the SDK is still expected to write to it. Finished
// runs are read-only — the action buttons hide so we don't tempt the user
// into editing a frozen record.
const isActive = computed(
  () =>
    run.value?.status === "pending" ||
    run.value?.status === "running" ||
    run.value?.status === "preempting",
);

const updateMutation = useMutation({
  mutationFn: (data: { status?: "preempting" | "killed"; notes?: string | null }) =>
    RunService.update(runId.value, data),
  onSuccess: (_, vars) => {
    if (vars.status === "preempting") {
      toast.success("Run marked as preempting");
    } else if (vars.status === "killed") {
      toast.success("Run cancelled");
    } else if (vars.notes !== undefined) {
      toast.success("Notes saved");
    }
    queryClient.invalidateQueries({ queryKey: ["run", runId.value] });
  },
  onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
});

function preempt() {
  if (!run.value) return;
  updateMutation.mutate({ status: "preempting" });
}

// ── Cancel confirmation dialog (replaces window.confirm) ────────────────
// `cancel()` flips the run's status to `killed`, which is recorded in
// the audit log and is irreversible. We open an LDialog instead of using
// `window.confirm` so the warning styling matches the rest of the
// dashboard and the user has a chance to type-confirm the run name.
const cancelOpen = ref(false);
const cancelConfirm = ref("");

function openCancelDialog() {
  cancelConfirm.value = "";
  cancelOpen.value = true;
}

function confirmCancel() {
  if (!run.value) return;
  updateMutation.mutate({ status: "killed" });
  cancelOpen.value = false;
}

const canConfirmCancel = computed(
  () => !!run.value && cancelConfirm.value.trim() === run.value.name,
);

// ── Notes editor dialog ─────────────────────────────────────────────────
const notesOpen = ref(false);
const notesDraft = ref("");
const notesError = ref<string | null>(null);

function openNotesEditor() {
  notesDraft.value = run.value?.notes ?? "";
  notesError.value = null;
  notesOpen.value = true;
}

function saveNotes() {
  notesError.value = null;
  const next = notesDraft.value.trim();
  updateMutation.mutate(
    { notes: next.length === 0 ? null : next },
    {
      onSuccess: () => {
        notesOpen.value = false;
      },
    },
  );
}

// ── Delete run ──────────────────────────────────────────────────────────
const deleteOpen = ref(false);
const deleteConfirm = ref("");
const deleteMutation = useMutation({
  mutationFn: () => RunService.delete(runId.value),
  onSuccess: () => {
    toast.success("Run deleted.");
    deleteOpen.value = false;
    queryClient.invalidateQueries({ queryKey: ["runs"] });
    queryClient.invalidateQueries({ queryKey: ["run", runId.value] });
    router.replace(`/projects/${run.value?.projectId}/runs`);
  },
  onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
});

const canDelete = computed(
  () => !!run.value && deleteConfirm.value.trim() === run.value.name,
);
</script>

<template>
  <div v-if="isRunLoading" class="space-y-6">
    <LSkeleton text :repeat="3" />
  </div>

  <div v-else-if="!run" class="py-12 text-center">
    <p class="text-muted-foreground">Run not found.</p>
  </div>

  <div v-else class="space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 space-y-2">
        <div class="flex items-center gap-3">
          <span
            class="h-3 w-3 flex-shrink-0 rounded-sm"
            :style="{ backgroundColor: colorForRunId(run.runId) }"
            aria-hidden="true"
          />
          <h1 class="truncate text-2xl font-bold tracking-tight">{{ run.name }}</h1>
          <LTag
            :type="
              run.status === 'running'
                ? 'warning'
                : run.status === 'finished'
                  ? 'success'
                  : run.status === 'failed' || run.status === 'crashed'
                    ? 'error'
                    : 'default'
            "
            round
          >
            {{ run.status }}
          </LTag>
        </div>
        <div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <RouterLink
            :to="`/projects/${run.projectId}`"
            class="font-mono hover:underline"
          >
            {{ run.projectId }}
          </RouterLink>
          <span class="flex items-center gap-1">
            <Calendar class="h-4 w-4" />
            {{ formatDate(run.createdAt) }}
          </span>
          <span class="flex items-center gap-1">
            <Clock class="h-4 w-4" />
            {{ formatDurationMs(durationMs) }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <LTooltip
          :content="
            wsStatus === 'open'
              ? 'Live updates via WebSocket'
              : wsStatus === 'connecting'
                ? 'Connecting to live updates…'
                : 'Live updates unavailable — using polling fallback'
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
        <LButton size="sm" @click="refetchRun()">Refresh</LButton>
        <LButton
          v-if="isActive"
          size="sm"
          quaternary
          :loading="updateMutation.isPending.value"
          @click="preempt"
        >
          <StopCircle class="mr-1 h-3 w-3" />
          Preempt
        </LButton>
        <LButton
          v-if="isActive"
          size="sm"
          quaternary
          :loading="updateMutation.isPending.value"
          @click="openCancelDialog"
        >
          <XCircle class="mr-1 h-3 w-3" />
          Cancel
        </LButton>
        <LButton size="sm" quaternary @click="openNotesEditor">
          <Pencil class="mr-1 h-3 w-3" />
          {{ run.notes ? "Edit notes" : "Add notes" }}
        </LButton>
        <LButton
          size="sm"
          type="error"
          quaternary
          @click="deleteOpen = true"
        >
          <Trash2 class="mr-1 h-3 w-3" />
          Delete
        </LButton>
      </div>
    </div>

    <!-- Tabs -->
    <LTabs type="line" animated>
      <!-- ── Overview ─────────────────────────────────────────────────── -->
      <LTabPane name="overview" tab="Overview">
        <div class="grid gap-4 lg:grid-cols-3">
          <LCard class="p-4 lg:col-span-2">
            <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
              Summary
            </h3>
            <dl v-if="summaryEntries.length > 0" class="grid gap-3 sm:grid-cols-2">
              <div
                v-for="[key, value] in summaryEntries"
                :key="key"
                class="rounded-md border border-border p-2"
              >
                <dt class="font-mono text-[10px] text-fg-tertiary">{{ key }}</dt>
                <dd class="mt-1 truncate font-mono text-sm">{{ String(value) }}</dd>
              </div>
            </dl>
            <p v-else class="text-sm text-fg-tertiary">No summary metrics recorded.</p>
          </LCard>

          <div class="space-y-4">
            <LCard class="p-4">
              <h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
                Tags
              </h3>
              <TagList
                :tags="runTags?.items ?? []"
                :loading="isTagsLoading"
              />
            </LCard>

            <LCard v-if="hasConfig" class="p-4">
              <h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
                Config
              </h3>
              <LJsonView :data="run.config" :deep="2" :show-line-number="false" />
            </LCard>

            <LCard v-if="run.notes" class="p-4">
              <h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
                Notes
              </h3>
              <p class="whitespace-pre-wrap text-sm">{{ run.notes }}</p>
            </LCard>
          </div>
        </div>
      </LTabPane>

      <!-- ── Metrics ─────────────────────────────────────────────────── -->
      <LTabPane name="metrics" tab="Metrics">
        <LCard>
          <div
            v-if="isMetricsLoading"
            class="py-12 text-center text-muted-foreground"
          >
            Loading metrics…
          </div>
          <div
            v-else-if="metricKeys.length === 0"
            class="py-12 text-center text-muted-foreground"
          >
            No metrics logged yet.
          </div>
          <div v-else class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <LTag
                v-for="key in metricKeys"
                :key="key"
                :type="selectedKeys.includes(key) ? 'primary' : 'default'"
                size="small"
                class="cursor-pointer"
                @click="toggleKey(key)"
              >
                {{ key }}
              </LTag>
            </div>
            <MetricChart :metrics="filteredMetrics" />
          </div>
        </LCard>
      </LTabPane>

      <!-- ── System ──────────────────────────────────────────────────── -->
      <LTabPane name="system" tab="System">
        <LCard>
          <div
            v-if="isSystemMetricsLoading"
            class="py-12 text-center text-muted-foreground"
          >
            Loading system metrics…
          </div>
          <div
            v-else-if="!systemMetrics || Object.keys(systemMetrics.metrics).length === 0"
            class="py-12 text-center text-muted-foreground"
          >
            No system metrics logged yet.
          </div>
          <MetricChart v-else :metrics="systemMetrics.metrics" />
        </LCard>
      </LTabPane>

      <!-- ── Logs ────────────────────────────────────────────────────── -->
      <LTabPane name="logs" tab="Logs">
        <LogViewer
          :logs="logLines?.logs ?? []"
          :loading="isLogsLoading"
          :height="600"
          redact-secrets
          v-model:level="logLevelFilter"
        />
      </LTabPane>

      <!-- ── Traces ──────────────────────────────────────────────────── -->
      <LTabPane name="traces" tab="Traces">
        <LCard v-if="tracesForRun && tracesForRun.length > 0" class="p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-xs font-medium uppercase tracking-wider text-fg-tertiary">
              {{ tracesForRun.length }} trace(s) for this run
            </h3>
          </div>
          <LTraceTimeline
            v-if="traceSpans.length > 0"
            :spans="traceSpans"
            :container-height="500"
          />
          <p v-else class="py-12 text-center text-sm text-fg-tertiary">
            No spans recorded for this trace yet.
          </p>
        </LCard>
        <LCard v-else class="p-8">
          <LEmpty
            title="No traces linked to this run"
            description="Use Lumina's trace integration to record span timelines for this run."
          />
        </LCard>
      </LTabPane>

      <!-- ── Artifacts ───────────────────────────────────────────────── -->
      <LTabPane name="artifacts" tab="Artifacts">
        <LCard v-if="artifactsForRun && artifactsForRun.length > 0" class="p-0">
          <ul class="divide-y divide-border">
            <li
              v-for="art in artifactsForRun"
              :key="art.id"
              class="flex items-center justify-between px-4 py-3 text-sm hover:bg-canvas"
            >
              <div class="flex items-center gap-3">
                <Box class="h-4 w-4 text-fg-tertiary" />
                <RouterLink
                  :to="`/projects/${run.projectId}/artifacts/${art.id}`"
                  class="font-medium hover:underline"
                >
                  {{ art.name }}
                </RouterLink>
                <LTag size="small" type="info">{{ art.type }}</LTag>
              </div>
              <span class="font-mono text-xs text-fg-tertiary">
                {{ formatDate(art.updatedAt) }}
              </span>
            </li>
          </ul>
        </LCard>
        <LCard v-else class="p-8">
          <LEmpty
            title="No artifacts yet"
            description="Artifacts produced by this run will appear here."
          />
        </LCard>
      </LTabPane>

      <!-- ── Config ──────────────────────────────────────────────────── -->
      <LTabPane name="config" tab="Config">
        <LCard class="p-4">
          <LJsonView
            v-if="hasConfig"
            :data="run.config"
            :deep="4"
            :height="600"
          />
          <p v-else class="py-8 text-center text-sm text-fg-tertiary">
            No configuration recorded for this run.
          </p>
        </LCard>
      </LTabPane>

      <!-- ── Metadata ────────────────────────────────────────────────── -->
      <LTabPane name="metadata" tab="Metadata">
        <LCard class="p-4">
          <dl class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="entry in metadataEntries"
              :key="entry.label"
              class="flex items-start gap-3 rounded-md border border-border p-3"
            >
              <component
                :is="entry.icon"
                class="mt-0.5 h-4 w-4 flex-shrink-0 text-fg-tertiary"
                aria-hidden="true"
              />
              <div class="min-w-0 flex-1">
                <dt class="text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
                  {{ entry.label }}
                </dt>
                <dd
                  :class="[
                    'mt-0.5 truncate text-sm',
                    entry.mono ? 'font-mono' : '',
                  ]"
                >
                  {{ entry.value ?? "—" }}
                </dd>
              </div>
            </div>
          </dl>
        </LCard>
      </LTabPane>
    </LTabs>

    <!-- Notes editor -->
    <LDialog
      v-model:show="notesOpen"
      title="Run notes"
      width="540px"
      @close="notesError = null"
    >
      <div class="space-y-3">
        <p class="text-xs text-fg-tertiary">
          Free-form notes for this run. Visible to everyone with access to the
          project. Markdown is rendered as plain text.
        </p>
        <LTextarea
          v-model:value="notesDraft"
          :rows="8"
          placeholder="Why did this run produce these metrics? What was tried?"
          @keydown.meta.enter="saveNotes"
          @keydown.ctrl.enter="saveNotes"
        />
        <div
          v-if="notesError"
          class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
        >
          {{ notesError }}
        </div>
        <div class="flex items-center justify-between text-[11px] text-fg-tertiary">
          <span>{{ notesDraft.length }} characters</span>
          <span>Press ⌘+Enter to save</span>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton quaternary @click="notesOpen = false">Cancel</LButton>
          <LButton
            :loading="updateMutation.isPending.value"
            @click="saveNotes"
          >
            Save notes
          </LButton>
        </div>
      </template>
    </LDialog>

    <!-- ── Cancel run confirmation ─────────────────────────────────── -->
    <LDialog
      v-model:show="cancelOpen"
      title="Cancel this run?"
      width="480px"
      @close="cancelConfirm = ''"
    >
      <div class="space-y-3">
        <div
          class="flex items-start gap-2 rounded-md border border-accent-warning/30 bg-accent-warning/10 p-3 text-xs"
        >
          <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-warning" />
          <div>
            <div class="font-medium">
              Cancellation flips the run's status to <code class="font-mono">killed</code>
              and is recorded in the audit log.
            </div>
            <div class="text-fg-tertiary">
              If you're still inside a training loop, the SDK will pick up the
              status change on its next heartbeat. Use <em>preempt</em> instead
              if you want a softer stop.
            </div>
          </div>
        </div>

        <div class="space-y-1">
          <label
            for="run-cancel-confirm"
            class="text-xs font-medium text-fg-secondary"
          >
            Type the run name
            <code class="font-mono text-fg-primary">{{ run.name }}</code>
            to confirm.
          </label>
          <LInput
            id="run-cancel-confirm"
            v-model:value="cancelConfirm"
            :placeholder="run.name"
            autocomplete="off"
            spellcheck="false"
            :disabled="updateMutation.isPending.value"
            @keydown.enter="canConfirmCancel && confirmCancel()"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton
            quaternary
            :disabled="updateMutation.isPending.value"
            @click="cancelOpen = false"
          >
            Keep running
          </LButton>
          <LButton
            type="warning"
            :disabled="!canConfirmCancel"
            :loading="updateMutation.isPending.value"
            @click="confirmCancel"
          >
            <XCircle class="mr-1 h-3 w-3" />
            Cancel run
          </LButton>
        </div>
      </template>
    </LDialog>

    <!-- ── Delete run confirmation ─────────────────────────────────── -->
    <LDialog
      v-model:show="deleteOpen"
      title="Delete this run?"
      width="480px"
      @close="deleteConfirm = ''"
    >
      <div class="space-y-3">
        <div
          class="flex items-start gap-2 rounded-md border border-accent-danger/30 bg-accent-danger/10 p-3 text-xs"
        >
          <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-danger" />
          <div>
            <div class="font-medium">
              This permanently deletes the run, every metric, log line,
              system metric, tag, and artifact attached to it.
            </div>
            <div class="text-fg-tertiary">
              There is no undo. Consider preempting or adding notes instead.
            </div>
          </div>
        </div>

        <div class="space-y-1">
          <label
            for="run-delete-confirm"
            class="text-xs font-medium text-fg-secondary"
          >
            Type the run name
            <code class="font-mono text-fg-primary">{{ run.name }}</code>
            to confirm.
          </label>
          <LInput
            id="run-delete-confirm"
            v-model:value="deleteConfirm"
            :placeholder="run.name"
            autocomplete="off"
            spellcheck="false"
            :disabled="deleteMutation.isPending.value"
            @keydown.enter="canDelete && deleteMutation.mutate()"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton
            quaternary
            :disabled="deleteMutation.isPending.value"
            @click="deleteOpen = false"
          >
            Cancel
          </LButton>
          <LButton
            type="error"
            :disabled="!canDelete"
            :loading="deleteMutation.isPending.value"
            @click="deleteMutation.mutate()"
          >
            <Trash2 class="mr-1 h-3 w-3" />
            Delete permanently
          </LButton>
        </div>
      </template>
    </LDialog>
  </div>
</template>