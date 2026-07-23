<script setup lang="ts">
import { ref, watch } from "vue";
import {
  LDialog,
  LTabs,
  LTabPane,
  LInput,
  LSelect,
  LTag,
  LButton,
  LIconButton,
  LSwitch,
  LSlider,
} from "@lumina/ui";
import {
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-vue-next";
import type { ChartPanelConfig } from "./ChartPanel.vue";
import { RUN_COLOR_PALETTE } from "@/composables/useRunColor";
import { useToast } from "@/composables/useToast";

const props = defineProps<{
  open: boolean;
  config: ChartPanelConfig;
  /** Run IDs currently shown in the panel — used for the Legend color picker. */
  runIds: string[];
  /** Map of runId → display name. */
  runNames: Record<string, string>;
  /** Map of runId → current color override (optional). */
  runColors?: Record<string, string>;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [config: ChartPanelConfig];
}>();

const toast = useToast();

const draft = ref<ChartPanelConfig>(structuredClone(props.config));
const colorOverrides = ref<Record<string, string>>({ ...(props.runColors ?? {}) });

// ── Tabs ──────────────────────────────────────────────────────────────
const activeTab = ref("data");

// ── Data tab fields ────────────────────────────────────────────────────
const xAxisOptions = [
  { label: "Step", value: "step" },
  { label: "Wall time", value: "wall" },
  { label: "Relative time", value: "relative" },
  { label: "Another metric", value: "metric" },
];
const yAxisOptions = [
  { label: "Linear", value: "linear" },
  { label: "Log", value: "log" },
];
const chartTypeOptions = [
  { label: "Line", value: "line" },
  { label: "Bar", value: "bar" },
  { label: "Scatter", value: "scatter" },
];

interface DataTab {
  xAxis: "step" | "wall" | "relative" | "metric";
  yAxis: "linear" | "log";
  chartType: "line" | "bar" | "scatter";
  smoothing: number;
  sampling: "raw" | "lttb" | "average";
  samplingThreshold: number;
  outlierClip: boolean;
}

const dataTab = ref<DataTab>({
  xAxis: "step",
  yAxis: "linear",
  chartType: "line",
  smoothing: 0,
  sampling: "lttb",
  samplingThreshold: 2000,
  outlierClip: false,
});

// ── Grouping tab fields ────────────────────────────────────────────────
const groupBy = ref<string | null>(null);
const aggregation = ref<"min" | "max" | "mean" | "none">("none");

// ── Chart tab fields ───────────────────────────────────────────────────
const chartTab = ref({
  title: props.config.title,
  xAxisTitle: "",
  yAxisTitle: "",
  legendVisible: true,
  legendPosition: "bottom" as "top" | "bottom" | "left" | "right",
});

watch(
  () => props.open,
  (open) => {
    if (open) {
      draft.value = structuredClone(props.config);
      chartTab.value.title = props.config.title;
    }
  },
);

// ── Expressions tab ────────────────────────────────────────────────────
interface DerivedMetric {
  name: string;
  expression: string;
}
const expressions = ref<DerivedMetric[]>([]);
function addExpression() {
  expressions.value.push({ name: "", expression: "" });
}
function removeExpression(idx: number) {
  expressions.value.splice(idx, 1);
}

// ── Save / reset ──────────────────────────────────────────────────────
function reset() {
  draft.value = structuredClone(props.config);
  chartTab.value.title = props.config.title;
  colorOverrides.value = { ...(props.runColors ?? {}) };
  dataTab.value = {
    xAxis: "step",
    yAxis: "linear",
    chartType: "line",
    smoothing: 0,
    sampling: "lttb",
    samplingThreshold: 2000,
    outlierClip: false,
  };
  expressions.value = [];
}

function save() {
  const next: ChartPanelConfig = {
    ...draft.value,
    title: chartTab.value.title || props.config.title,
    metricKeys: draft.value.metricKeys,
    smoothing: dataTab.value.smoothing || undefined,
    data: { ...dataTab.value },
    chart: { ...chartTab.value },
    grouping: {
      groupBy: groupBy.value,
      aggregation: aggregation.value,
    },
    expressions: [...expressions.value],
    colorOverrides: { ...colorOverrides.value },
  };
  emit("save", next);
  emit("update:open", false);
  toast.success("Panel configured");
}

function setColor(runId: string, color: string) {
  colorOverrides.value = { ...colorOverrides.value, [runId]: color };
}

const colorList = RUN_COLOR_PALETTE;

// Add metric key dialog (replaces window.prompt). The outer <LDialog> is the
// chart config modal itself; this nested LDialog opens on top via Teleport.
const addMetricKeyOpen = ref(false);
const newMetricKeyDraft = ref("");
const metricKeyError = ref<string | null>(null);

function openAddMetricKey() {
  newMetricKeyDraft.value = "";
  metricKeyError.value = null;
  addMetricKeyOpen.value = true;
}

function submitAddMetricKey() {
  const key = newMetricKeyDraft.value.trim();
  if (!key) {
    metricKeyError.value = "Metric key is required";
    return;
  }
  if (!draft.value.metricKeys.includes(key)) {
    draft.value.metricKeys = [...draft.value.metricKeys, key];
  }
  addMetricKeyOpen.value = false;
}

function removeMetricKey(key: string) {
  draft.value.metricKeys = draft.value.metricKeys.filter((k) => k !== key);
}
</script>

<template>
  <LDialog
    :show="open"
    title="Configure chart panel"
    width="640px"
    @update:show="(v: boolean) => emit('update:open', v)"
  >
    <LTabs v-model:value="activeTab" type="line">
      <!-- ── Data ────────────────────────────────────────────────── -->
      <LTabPane name="data" tab="Data">
        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-medium text-fg-secondary">
              Metric keys
            </label>
            <div class="flex flex-wrap items-center gap-1">
              <LTag
                v-for="key in draft.metricKeys"
                :key="key"
                size="small"
                type="info"
                closable
                @close="removeMetricKey(key)"
              >
                {{ key }}
              </LTag>
              <LButton size="xs" quaternary @click="openAddMetricKey">
                <Plus class="mr-1 h-3 w-3" />
                Add
              </LButton>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-medium text-fg-secondary">
                X axis
              </label>
              <LSelect
                v-model:value="dataTab.xAxis"
                :options="xAxisOptions"
                size="small"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-fg-secondary">
                Y axis scale
              </label>
              <LSelect
                v-model:value="dataTab.yAxis"
                :options="yAxisOptions"
                size="small"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-fg-secondary">
                Chart type
              </label>
              <LSelect
                v-model:value="dataTab.chartType"
                :options="chartTypeOptions"
                size="small"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-fg-secondary">
                Sampling
              </label>
              <LSelect
                v-model:value="dataTab.sampling"
                :options="[
                  { label: 'Raw', value: 'raw' },
                  { label: 'LTTB', value: 'lttb' },
                  { label: 'Average', value: 'average' },
                ]"
                size="small"
              />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-fg-secondary">
              Smoothing window
              <span class="ml-1 font-mono text-fg-tertiary">({{ dataTab.smoothing }})</span>
            </label>
            <LSlider
              :model-value="dataTab.smoothing"
              :min="0"
              :max="50"
              :step="1"
              @update:value="(v) => (dataTab.smoothing = Number(v))"
            />
          </div>

          <div class="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <div class="text-xs font-medium">Clip outliers</div>
              <div class="text-[10px] text-fg-tertiary">
                Clip values outside the 1st–99th percentile.
              </div>
            </div>
            <LSwitch v-model:value="dataTab.outlierClip" />
          </div>
        </div>
      </LTabPane>

      <!-- ── Grouping ───────────────────────────────────────────── -->
      <LTabPane name="grouping" tab="Grouping">
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-fg-secondary">
              Group by
            </label>
            <LSelect
              v-model:value="groupBy"
              :options="[
                { label: 'None', value: '' },
                { label: 'Run', value: 'run' },
                { label: 'Sweep', value: 'sweep' },
                { label: 'Tag', value: 'tag' },
              ]"
              placeholder="No grouping"
              clearable
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-fg-secondary">
              Aggregation (multi-run bands)
            </label>
            <LSelect
              v-model:value="aggregation"
              :options="[
                { label: 'None (overlay lines)', value: 'none' },
                { label: 'Mean ± std band', value: 'mean' },
                { label: 'Min/max envelope', value: 'min' },
                { label: 'Max only', value: 'max' },
              ]"
            />
          </div>
          <p class="text-xs text-fg-tertiary">
            Aggregation bands render when the panel has 3+ selected runs.
          </p>
        </div>
      </LTabPane>

      <!-- ── Chart ─────────────────────────────────────────────── -->
      <LTabPane name="chart" tab="Chart">
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-fg-secondary">
              Title
            </label>
            <LInput v-model:value="chartTab.title" placeholder="Panel title" />
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-medium text-fg-secondary">
                X axis title
              </label>
              <LInput v-model:value="chartTab.xAxisTitle" placeholder="Step" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-fg-secondary">
                Y axis title
              </label>
              <LInput v-model:value="chartTab.yAxisTitle" placeholder="Value" />
            </div>
          </div>
          <div class="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span class="text-xs font-medium">Show legend</span>
            <LSwitch v-model:value="chartTab.legendVisible" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-fg-secondary">
              Legend position
            </label>
            <LSelect
              v-model:value="chartTab.legendPosition"
              :options="[
                { label: 'Top', value: 'top' },
                { label: 'Bottom', value: 'bottom' },
                { label: 'Left', value: 'left' },
                { label: 'Right', value: 'right' },
              ]"
            />
          </div>
        </div>
      </LTabPane>

      <!-- ── Legend ────────────────────────────────────────────── -->
      <LTabPane name="legend" tab="Legend">
        <p class="mb-3 text-xs text-fg-tertiary">
          Override the deterministic run color. Useful when two important runs
          end up with similar hues.
        </p>
        <div v-if="runIds.length === 0" class="py-6 text-center text-xs text-fg-tertiary">
          Pin runs in the sidebar first to color them.
        </div>
        <ul v-else class="space-y-2">
          <li
            v-for="runId in runIds"
            :key="runId"
            class="flex items-center gap-3 rounded-md border border-border px-3 py-2"
          >
            <span class="min-w-0 flex-1 truncate text-sm">
              {{ runNames[runId] ?? runId }}
            </span>
            <div class="flex flex-wrap gap-1">
              <LButton
                v-for="c in colorList"
                :key="c"
                quaternary
                size="xs"
                :class="[
                  '!h-5 !w-5 !rounded-sm !border !p-0',
                  (colorOverrides[runId] ?? '') === c
                    ? '!border-fg-primary !scale-110'
                    : '!border-border hover:!scale-105',
                ]"
                :style="{ backgroundColor: c }"
                :aria-label="`Set color ${c}`"
                @click="setColor(runId, c)"
              />
          </div>
          </li>
        </ul>
      </LTabPane>

      <!-- ── Expressions ──────────────────────────────────────── -->
      <LTabPane name="expressions" tab="Expressions">
        <p class="mb-3 text-xs text-fg-tertiary">
          Derived metrics computed from logged values. Use the syntax
          <code class="font-mono">other_metric</code> and JS arithmetic
          (+, -, *, /).
        </p>
        <ul class="space-y-2">
          <li
            v-for="(expr, idx) in expressions"
            :key="idx"
            class="flex items-center gap-2"
          >
            <LInput v-model:value="expr.name" placeholder="name" size="small" style="width: 120px" />
            <span class="font-mono text-fg-tertiary">=</span>
            <LInput v-model:value="expr.expression" placeholder="loss / max(1, step)" size="small" class="flex-1" />
            <LIconButton aria-label="Remove" size="small" @click="removeExpression(idx)">
              <Trash2 class="h-3 w-3" />
            </LIconButton>
          </li>
        </ul>
        <LButton size="xs" quaternary class="mt-2" @click="addExpression">
          <Plus class="mr-1 h-3 w-3" />
          Add derived metric
        </LButton>
      </LTabPane>
    </LTabs>

    <template #footer>
      <div class="flex items-center justify-between">
        <LButton quaternary size="sm" @click="reset">
          <RotateCcw class="mr-1 h-3 w-3" />
          Reset
        </LButton>
        <div class="flex gap-2">
          <LButton quaternary @click="emit('update:open', false)">Cancel</LButton>
          <LButton @click="save">Save</LButton>
        </div>
      </div>
    </template>
  </LDialog>

  <LDialog
    v-model:show="addMetricKeyOpen"
    title="Add metric key"
    width="480px"
    @close="metricKeyError = null"
  >
    <form class="space-y-3" @submit.prevent="submitAddMetricKey">
      <div>
        <label for="metric-key-input" class="mb-1 block text-xs font-medium text-fg-secondary">
          Metric key <span class="text-accent-danger">*</span>
        </label>
        <LInput
          id="metric-key-input"
          v-model:value="newMetricKeyDraft"
          placeholder="train/loss"
          autofocus
        />
      </div>
      <div
        v-if="metricKeyError"
        class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
      >
        {{ metricKeyError }}
      </div>
    </form>
    <template #footer>
      <div class="flex justify-end gap-2">
        <LButton quaternary @click="addMetricKeyOpen = false">Cancel</LButton>
        <LButton
          :disabled="!newMetricKeyDraft.trim()"
          @click="submitAddMetricKey"
        >
          Add
        </LButton>
      </div>
    </template>
  </LDialog>
</template>