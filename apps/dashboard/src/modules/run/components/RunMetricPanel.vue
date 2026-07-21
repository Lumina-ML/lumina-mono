<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { LCard, LTag } from "@lumina/ui";
import { useMetrics } from "@/modules/metric/composables/useMetrics";
import { useSystemMetrics } from "@/modules/metric/composables/useSystemMetrics";
import MetricChart from "@/widgets/metric-chart/MetricChart.vue";
import type { Run } from "@/types/run";

/**
 * Run-time metrics panel for RunDetail.
 *
 * Two variants share the same chrome (loading/empty state) but pull from
 * different sources:
 *   - "run"     → SDK-logged scalar series for the run, with a user-selectable
 *                 subset persisted across reloads.
 *   - "system"  → host metrics (CPU/GPU/RAM/...) emitted by the SDK alongside
 *                 the run, no toggle, full chart.
 *
 * Lifted out of RunDetail.vue so the page can stay focused on layout + tab
 * orchestration. State here is fully internal — nothing is shared with sibling
 * tabs.
 *
 * The metrics/systemMetrics queries are owned here; RunDetail triggers
 * refreshes via queryClient.invalidateQueries on the same keys
 * (["metrics", runId] / ["systemMetrics", runId]) so Vue Query deduplicates
 * between the two callers.
 */
const props = defineProps<{
  runId: string;
  run: Run | null;
  source: "run" | "system";
}>();

const runIdRef = computed(() => props.runId);
const { data: metrics, isLoading: isMetricsLoading } = useMetrics(runIdRef);
const { data: systemMetrics, isLoading: isSystemMetricsLoading } =
  useSystemMetrics(runIdRef);

// ── "run" variant: persisted key selection ───────────────────────────
const metricKeys = computed(() =>
  metrics.value ? Object.keys(metrics.value.metrics) : [],
);
const selectedKeys = ref<string[]>([]);

// Persist the user's metric selection so reopening the run restores it.
const METRIC_KEYS_STORAGE_PREFIX = "lumina:run-metric-keys:";
const metricStorageKey = computed(() =>
  props.run
    ? `${METRIC_KEYS_STORAGE_PREFIX}${props.run.projectId}:${props.run.runId}`
    : null,
);

function readPersistedKeys(): string[] | null {
  if (!metricStorageKey.value) return null;
  try {
    const raw = localStorage.getItem(metricStorageKey.value);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((k): k is string => typeof k === "string")
      : null;
  } catch {
    return null;
  }
}

// Default selection: summary-flagged keys first, the rest alphabetical,
// capped at 5. Plain alphabetical when there's no summary.
function defaultKeys(keys: string[]): string[] {
  const summary = (props.run?.summary ?? {}) as Record<string, unknown>;
  const summaryKeys = Object.keys(summary).filter((k) => keys.includes(k));
  const rest = keys
    .filter((k) => !summaryKeys.includes(k))
    .sort((a, b) => a.localeCompare(b));
  return [...summaryKeys, ...rest].slice(0, 5);
}

// Initialize the selection once per run, once metrics have loaded. A persisted
// choice (filtered to keys that still exist) wins, otherwise the summary-first
// default. `initializedFor` stops later metric updates for the same run from
// clobbering the user's toggles.
const initializedFor = ref<string | null>(null);
watch(
  [metricKeys, () => props.run?.runId, isMetricsLoading],
  ([keys, currentRunId, loading]) => {
    if (!currentRunId || loading || keys.length === 0) return;
    if (initializedFor.value === currentRunId) return;

    const persisted =
      readPersistedKeys()?.filter((k) => keys.includes(k)) ?? [];
    selectedKeys.value = persisted.length > 0 ? persisted : defaultKeys(keys);
    initializedFor.value = currentRunId;
  },
  { immediate: true },
);

watch(selectedKeys, (keys) => {
  if (!metricStorageKey.value || initializedFor.value === null) return;
  try {
    localStorage.setItem(metricStorageKey.value, JSON.stringify(keys));
  } catch {
    // storage unavailable / over quota — non-fatal
  }
});

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
</script>

<template>
  <LCard>
    <!-- ── Run-time metrics ──────────────────────────────────────── -->
    <template v-if="source === 'run'">
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
    </template>

    <!-- ── System metrics ────────────────────────────────────────── -->
    <template v-else>
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
    </template>
  </LCard>
</template>
