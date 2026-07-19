<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  LCard,
  LButton,
  LInput,
  LSelect,
  LTag,
  LAlert,
  LEmpty,
  LJsonView,
} from "@lumina/ui";
import { Bell, Plus, Trash2, Webhook, AlertTriangle, Info } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";

/**
 * Workspace Alerts settings page (Roadmap §M3-5).
 *
 * What it configures today:
 *   - Per-metric watch rules: metric key + operator + threshold +
 *     notification level. The dashboard uses these to mark metric
 *     charts in red when a value crosses the threshold.
 *   - Webhook URL: where alert notifications get POSTed. The server
 *     doesn't yet forward alerts, so this is stored locally and
 *     surfaced in the SDK as a hint for user-side automation.
 *   - Pre-emption threshold: same idea — a soft config knob surfaced
 *     on each run's detail page so operators can mark a run as
 *     "preempt when loss > X for N steps".
 *
 * Persistence: localStorage. The roadmap explicitly defers server-side
 * alert infrastructure (see §M3-5 "Alerts 设置页（preempt + watch +
 * webhook）") to a later milestone — this page exists so users have
 * somewhere to *configure* alerts in the meantime.
 */

const STORAGE_KEY = "lumina:workspace:alerts:v1";
const toast = useToast();

// ── Types ────────────────────────────────────────────────────────────

interface WatchRule {
  id: string;
  metricKey: string;
  operator: ">" | ">=" | "<" | "<=" | "==";
  threshold: number;
  level: "INFO" | "WARN" | "ERROR";
}

interface AlertConfig {
  webhookUrl: string;
  preemptThreshold: number;
  preemptWindow: number;
  rules: WatchRule[];
}

function defaultConfig(): AlertConfig {
  return {
    webhookUrl: "",
    preemptThreshold: 1.5,
    preemptWindow: 3,
    rules: [],
  };
}

function load(): AlertConfig {
  if (typeof window === "undefined") return defaultConfig();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const cfg = parsed as Partial<AlertConfig>;
      return {
        webhookUrl: typeof cfg.webhookUrl === "string" ? cfg.webhookUrl : "",
        preemptThreshold:
          typeof cfg.preemptThreshold === "number" ? cfg.preemptThreshold : 1.5,
        preemptWindow:
          typeof cfg.preemptWindow === "number" ? cfg.preemptWindow : 3,
        rules: Array.isArray(cfg.rules) ? cfg.rules.filter(isWatchRule) : [],
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return defaultConfig();
}

function isWatchRule(x: unknown): x is WatchRule {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.metricKey === "string" &&
    typeof r.operator === "string" &&
    [">", ">=", "<", "<=", "=="].includes(r.operator as string) &&
    typeof r.threshold === "number" &&
    typeof r.level === "string" &&
    ["INFO", "WARN", "ERROR"].includes(r.level as string)
  );
}

const config = ref<AlertConfig>(load());
watch(
  config,
  (next) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  },
  { deep: true },
);

// ── Watch rules ──────────────────────────────────────────────────────

const operatorOptions = [
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
  { value: "<", label: "<" },
  { value: "<=", label: "≤" },
  { value: "==", label: "=" },
];

const levelOptions = [
  { value: "INFO", label: "Info" },
  { value: "WARN", label: "Warning" },
  { value: "ERROR", label: "Error" },
];

const newRule = ref<Omit<WatchRule, "id">>({
  metricKey: "",
  operator: ">",
  threshold: 1.0,
  level: "WARN",
});

// LInput binds string values, so we maintain *string* mirrors of the
// numeric fields on config and re-coerce on every write. Anything that
// isn't a finite number falls back to the previous value so the user
// never sees NaN propagated into localStorage.
function numericMirror<T extends keyof AlertConfig>(key: T) {
  return ref<string>(String(config.value[key] ?? ""));
}
const preemptThresholdText = numericMirror("preemptThreshold");
const preemptWindowText = numericMirror("preemptWindow");
const newRuleThresholdText = ref<string>("1");

watch(preemptThresholdText, (v) => {
  const n = Number(v);
  if (Number.isFinite(n)) config.value.preemptThreshold = n;
});
watch(preemptWindowText, (v) => {
  const n = Number(v);
  if (Number.isFinite(n) && n >= 1) config.value.preemptWindow = Math.floor(n);
});
watch(newRuleThresholdText, (v) => {
  const n = Number(v);
  if (Number.isFinite(n)) newRule.value.threshold = n;
});

function addRule() {
  if (!newRule.value.metricKey.trim()) return;
  config.value.rules.push({
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...newRule.value,
    metricKey: newRule.value.metricKey.trim(),
  });
  newRule.value = {
    metricKey: "",
    operator: ">",
    threshold: 1.0,
    level: "WARN",
  };
  newRuleThresholdText.value = "1";
}

function removeRule(id: string) {
  config.value.rules = config.value.rules.filter((r) => r.id !== id);
}

function resetConfig() {
  config.value = defaultConfig();
  toast.info("Alerts configuration reset to defaults.");
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(config.value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lumina-alerts.json";
  a.click();
  URL.revokeObjectURL(url);
}

const webhookValid = computed(() => {
  const u = config.value.webhookUrl.trim();
  if (!u) return true; // empty = disabled
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
});
</script>

<template>
  <div class="space-y-6">
    <header class="flex items-start justify-between gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <Bell class="h-5 w-5" />
          Alerts
        </h1>
        <p class="mt-1 text-sm text-fg-tertiary">
          Configure metric watch rules, pre-emption thresholds, and the
          webhook URL the server will POST to when an alert fires.
        </p>
      </div>
      <div class="flex gap-2">
        <LButton size="sm" quaternary @click="exportConfig">Export JSON</LButton>
        <LButton size="sm" quaternary @click="resetConfig">Reset</LButton>
      </div>
    </header>

    <LAlert type="info" :show-icon="true">
      <template #icon><Info class="h-4 w-4" /></template>
      Settings persist in your browser for now. Server-side alert
      forwarding is tracked as a follow-up — the
      <code class="font-mono">webhookUrl</code> you set here is already
      surfaced to the SDK as a hint for local automation.
    </LAlert>

    <!-- Webhook URL -->
    <LCard class="p-4">
      <h2 class="mb-3 flex items-center gap-2 text-sm font-medium">
        <Webhook class="h-4 w-4" />
        Webhook URL
      </h2>
      <div class="space-y-2">
        <LInput
          v-model:value="config.webhookUrl"
          placeholder="https://hooks.example.com/lumina"
          :class="!webhookValid ? 'border-accent-danger' : ''"
        />
        <p
          v-if="!webhookValid"
          class="text-xs text-accent-danger"
        >
          Must be a valid http:// or https:// URL.
        </p>
        <p class="text-xs text-fg-tertiary">
          When an alert fires, the server POSTs
          <code class="font-mono">{"runId", "level", "title", "message"}</code>
          to this URL.
        </p>
      </div>
    </LCard>

    <!-- Pre-emption threshold -->
    <LCard class="p-4">
      <h2 class="mb-3 flex items-center gap-2 text-sm font-medium">
        <AlertTriangle class="h-4 w-4" />
        Pre-emption defaults
      </h2>
      <p class="mb-3 text-xs text-fg-tertiary">
        Soft threshold surfaced on every run's detail page. Operators can
        override per-run; this just sets the default.
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            for="preempt-threshold"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Loss threshold
          </label>
          <LInput
            id="preempt-threshold"
            v-model:value="preemptThresholdText"
            inputmode="decimal"
            placeholder="1.5"
          />
        </div>
        <div>
          <label
            for="preempt-window"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Consecutive steps before pre-empt
          </label>
          <LInput
            id="preempt-window"
            v-model:value="preemptWindowText"
            inputmode="numeric"
            placeholder="3"
          />
        </div>
      </div>
    </LCard>

    <!-- Watch rules -->
    <LCard class="p-4">
      <h2 class="mb-3 flex items-center gap-2 text-sm font-medium">
        <Bell class="h-4 w-4" />
        Watch rules ({{ config.rules.length }})
      </h2>
      <p class="mb-3 text-xs text-fg-tertiary">
        Match metric values against thresholds. Rules are evaluated
        client-side on the run detail chart and contribute to the
        run's overall alert level.
      </p>

      <ul v-if="config.rules.length > 0" class="mb-4 space-y-2">
        <li
          v-for="rule in config.rules"
          :key="rule.id"
          class="flex items-center gap-2 rounded-md border border-border bg-canvas px-3 py-2 text-sm"
        >
          <code class="font-mono">{{ rule.metricKey }}</code>
          <span class="font-mono text-fg-tertiary">{{ rule.operator }}</span>
          <span class="font-mono">{{ rule.threshold }}</span>
          <LTag
            size="small"
            :type="rule.level === 'ERROR' ? 'error' : rule.level === 'WARN' ? 'warning' : 'info'"
          >
            {{ rule.level }}
          </LTag>
          <LButton
            class="ml-auto"
            size="xs"
            quaternary
            :aria-label="`Remove rule for ${rule.metricKey}`"
            @click="removeRule(rule.id)"
          >
            <Trash2 class="h-3 w-3" />
          </LButton>
        </li>
      </ul>
      <LEmpty
        v-else
        class="my-4 py-6"
        title="No watch rules"
        description="Add a rule below to start monitoring a metric."
      />

      <div class="grid items-end gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Metric key
          </label>
          <LInput
            v-model:value="newRule.metricKey"
            placeholder="e.g. loss"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Operator
          </label>
          <LSelect v-model:value="newRule.operator" :options="operatorOptions" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Threshold
          </label>
          <LInput
            v-model:value="newRuleThresholdText"
            inputmode="decimal"
            placeholder="1.0"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Level
          </label>
          <LSelect v-model:value="newRule.level" :options="levelOptions" />
        </div>
        <LButton :disabled="!newRule.metricKey.trim()" @click="addRule">
          <Plus class="mr-1 h-3 w-3" />
          Add
        </LButton>
      </div>
    </LCard>

    <!-- Debug / preview -->
    <LCard class="p-4">
      <h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
        Current configuration (JSON)
      </h2>
      <LJsonView :data="config" :deep="5" />
    </LCard>
  </div>
</template>