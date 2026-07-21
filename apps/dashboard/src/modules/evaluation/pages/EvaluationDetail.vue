<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  LSkeleton,
  LTag,
  LCard,
  LEmpty,
  LTabs,
  LTabPane,
  LSlider,
  LStatistic,
  LDialog,
  LInput,
  LSelect,
  LButton,
} from "@lumina/ui";
import { ArrowLeft, PackageOpen } from "lucide-vue-next";
import { useEvaluation } from "@/modules/evaluation/composables/useEvaluations";
import { EvaluationService } from "@/services/evaluation.service";
import { RegistryService } from "@/services/registry.service";
import { ArtifactService } from "@/services/artifact.service";
import { useModels } from "@/modules/registry-model/composables/useModels";
import { useDateFormat } from "@/composables/useDateFormat";
import { useToast } from "@/composables/useToast";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { ApiError } from "@/services/api";
import {
  confusionMatrixStats,
  perClassMetrics,
} from "@/widgets/evaluation/useEvaluationViz";
import type {
  ConfusionMatrix,
  PRPoint,
  ThresholdSample,
} from "@/widgets/evaluation/types";
import ConfusionMatrixView from "@/widgets/evaluation/ConfusionMatrix.vue";
import PRCurveView from "@/widgets/evaluation/PRCurve.vue";
import MetricsTable from "@/widgets/evaluation/MetricsTable.vue";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const evaluationId = computed(() => route.params.evaluationId as string);
const { formatDate } = useDateFormat();

const { data: evaluation, isLoading } = useEvaluation(evaluationId);

const { data: results } = useQuery({
  queryKey: computed(() => ["evaluation-results", evaluationId.value]),
  queryFn: () => EvaluationService.listResults(evaluationId.value),
});

// ── Real data only ──────────────────────────────────────────────────────
// Everything below reads from recorded scalar results + Evaluation.summary.
// Nothing is synthesized: when the eval pipeline hasn't written a structured
// payload, the corresponding view degrades to an empty state that tells the
// user which SDK call produces it.
const summary = computed(
  () => (evaluation.value?.summary ?? {}) as Record<string, unknown>,
);

// Scalar metrics = per-result rows, with summary scalars layered underneath.
const summaryMetrics = computed(() => {
  const out: Record<string, number> = {};
  for (const x of results.value ?? []) out[x.key] = x.value;
  for (const [k, v] of Object.entries(summary.value)) {
    if (typeof v === "number") out[k] = out[k] ?? v;
  }
  return out;
});

const scalarRows = computed(() =>
  Object.entries(summaryMetrics.value).sort(([a], [b]) => a.localeCompare(b)),
);

const confusionMatrix = computed<ConfusionMatrix | null>(() => {
  const cm = summary.value.confusion_matrix as ConfusionMatrix | undefined;
  return cm?.labels?.length && cm.matrix?.length ? cm : null;
});

const prCurve = computed<PRPoint[] | null>(() => {
  const pr = summary.value.pr_curve as PRPoint[] | undefined;
  return Array.isArray(pr) && pr.length > 0 ? pr : null;
});

const thresholdSweep = computed<ThresholdSample[] | null>(() => {
  const t = summary.value.threshold_sweep as ThresholdSample[] | undefined;
  return Array.isArray(t) && t.length > 0 ? t : null;
});

const stats = computed(() =>
  confusionMatrix.value ? confusionMatrixStats(confusionMatrix.value) : null,
);
const perClass = computed(() =>
  confusionMatrix.value ? perClassMetrics(confusionMatrix.value) : [],
);

// ── Stat cards (null → "—", never fabricated) ────────────────────────────
function fmtPct(v: number | null | undefined): string {
  return typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—";
}

const accuracyValue = computed<number | null>(() => {
  if (stats.value) return stats.value.accuracy;
  const a = summaryMetrics.value["accuracy"];
  return typeof a === "number" ? a : null;
});

const macroF1Value = computed<number | null>(() => {
  if (perClass.value.length) {
    return (
      perClass.value.reduce((a, x) => a + x.f1, 0) / perClass.value.length
    );
  }
  const f1 = summaryMetrics.value["macro_f1"] ?? summaryMetrics.value["f1"];
  return typeof f1 === "number" ? f1 : null;
});

const classCount = computed<number | null>(() =>
  perClass.value.length ? perClass.value.length : null,
);

const sampleCount = computed<number | null>(() => {
  if (stats.value) return stats.value.total;
  const n = summaryMetrics.value["num_samples"];
  return typeof n === "number" ? n : null;
});

// ── Threshold slider (drives off real sweep samples) ──────────────────────
const thresholdPct = ref(50);
const thresholdSampleAt = computed<ThresholdSample | null>(() => {
  const samples = thresholdSweep.value;
  if (!samples) return null;
  const idx = Math.min(
    samples.length - 1,
    Math.round((thresholdPct.value / 100) * (samples.length - 1)),
  );
  return samples[idx] ?? null;
});

const statusVariant = computed(() => {
  const s = evaluation.value?.status;
  if (s === "completed") return "success" as const;
  if (s === "running") return "info" as const;
  if (s === "failed") return "error" as const;
  return "default" as const;
});

// ── Promote evaluation to model registry ────────────────────────────────
const toast = useToast();
const queryClient = useQueryClient();
const promoteOpen = ref(false);
const promoteModelName = ref("");
const promoteAliasText = ref("latest");
const promoteError = ref<string | null>(null);

const { data: models } = useModels(
  computed(() => ({ projectId: evaluation.value?.projectId, limit: 200 })),
);

const modelOptions = computed(() =>
  (models.value?.items ?? []).map((m) => ({ label: m.name, value: m.name })),
);

const promoteMutation = useMutation({
  mutationFn: async () => {
    if (!evaluation.value) throw new Error("No evaluation");
    const projectId = evaluation.value.projectId;
    const artifactVersionId = evaluation.value.modelArtifactVersionId;
    if (!artifactVersionId) {
      throw new Error("Evaluation has no linked model artifact version");
    }
    if (!promoteModelName.value.trim()) {
      throw new Error("Model name is required");
    }

    let modelId: string;
    try {
      const created = await RegistryService.create(projectId, {
        name: promoteModelName.value.trim(),
      });
      modelId = created.id;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const list = await RegistryService.list({ projectId, limit: 200 });
        const found = list.items.find(
          (m) => m.name === promoteModelName.value.trim(),
        );
        if (!found) throw new Error("Model exists but couldn't be loaded");
        modelId = found.id;
      } else {
        throw e;
      }
    }

    const aliases = promoteAliasText.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return RegistryService.createVersion(modelId, artifactVersionId, aliases);
  },
  onSuccess: (version) => {
    toast.success(
      `Promoted to ${promoteModelName.value}@${version.version}`,
    );
    promoteOpen.value = false;
    queryClient.invalidateQueries({ queryKey: ["registry-models"] });
  },
  onError: (e) => {
    promoteError.value = (e as Error).message ?? "Unknown error";
  },
});

function openPromote() {
  promoteModelName.value = "";
  promoteAliasText.value = "latest";
  promoteError.value = null;
  promoteOpen.value = true;
}
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      :to="`/projects/${projectId}`"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to project
    </RouterLink>

    <LSkeleton v-if="isLoading" text :repeat="3" />

    <template v-else-if="evaluation">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-2xl font-semibold tracking-tight">
            {{ evaluation.name }}
          </h1>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-fg-tertiary">
            <LTag size="small" :type="statusVariant">{{ evaluation.status }}</LTag>
            <span>Created {{ formatDate(evaluation.createdAt) }}</span>
            <RouterLink
              v-if="evaluation.runId"
              :to="`/projects/${projectId}/runs/${evaluation.runId}`"
              class="font-mono text-xs hover:underline"
            >
              {{ evaluation.runId.slice(0, 12) }}
            </RouterLink>
          </div>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LCard class="p-4">
          <LStatistic label="Accuracy" :value="fmtPct(accuracyValue)" />
          <div
            v-if="stats"
            class="mt-1 font-mono text-[10px] text-fg-tertiary"
          >
            {{ stats.correct }} / {{ stats.total }} correct
          </div>
        </LCard>
        <LCard class="p-4">
          <LStatistic label="Macro F1" :value="fmtPct(macroF1Value)" />
        </LCard>
        <LCard class="p-4">
          <LStatistic
            label="Classes"
            :value="classCount === null ? '—' : String(classCount)"
          />
        </LCard>
        <LCard class="p-4">
          <LStatistic
            label="Samples"
            :value="sampleCount === null ? '—' : String(sampleCount)"
          />
        </LCard>
      </div>

      <LTabs type="line" animated>
        <!-- ── Confusion matrix ────────────────────────────────────────── -->
        <LTabPane name="overview" tab="Overview">
          <ConfusionMatrixView v-if="confusionMatrix" :matrix="confusionMatrix" />
          <LCard v-else class="p-8">
            <LEmpty
              title="No confusion matrix recorded"
              description="Record one from your eval pipeline via lumina.log_eval_summary(confusion_matrix={'labels': [...], 'matrix': [[...]]})."
            />
          </LCard>
        </LTabPane>

        <!-- ── Per-class or scalar metrics ─────────────────────────────── -->
        <LTabPane name="metrics" tab="Metrics">
          <MetricsTable v-if="perClass.length" :rows="perClass" />
          <LCard v-else-if="scalarRows.length" class="p-0">
            <div class="border-b border-border px-4 py-3">
              <h3 class="text-xs font-medium uppercase tracking-wider text-fg-tertiary">
                Recorded metrics
              </h3>
            </div>
            <ul class="divide-y divide-border">
              <li
                v-for="[key, value] in scalarRows"
                :key="key"
                class="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span class="font-mono text-fg-tertiary">{{ key }}</span>
                <span class="font-mono">{{ value }}</span>
              </li>
            </ul>
          </LCard>
          <LCard v-else class="p-8">
            <LEmpty
              title="No metrics yet"
              description="Log scalars with lumina.log_eval_result(key, value), or a confusion matrix via lumina.log_eval_summary(...)."
            />
          </LCard>
        </LTabPane>

        <!-- ── PR curve ────────────────────────────────────────────────── -->
        <LTabPane name="pr" tab="PR Curve">
          <LCard class="p-4">
            <PRCurveView v-if="prCurve" :points="prCurve" :height="380" />
            <LEmpty
              v-else
              title="No PR curve recorded"
              description="Record precision/recall points via lumina.log_eval_summary(pr_curve=[{'recall': .., 'precision': ..}, ...])."
            />
          </LCard>
        </LTabPane>

        <!-- ── Threshold sweep ─────────────────────────────────────────── -->
        <LTabPane name="threshold" tab="Threshold">
          <LCard class="p-4">
            <div
              v-if="thresholdSweep && thresholdSampleAt"
              class="grid gap-6 lg:grid-cols-[1fr_300px]"
            >
              <div>
                <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
                  Threshold sweep
                </h3>
                <PRCurveView
                  :points="thresholdSweep.map((s) => ({ recall: s.recall, precision: s.precision }))"
                  :height="320"
                />
              </div>
              <div class="space-y-4">
                <div>
                  <label class="mb-1 block text-xs font-medium text-fg-secondary">
                    Threshold
                    <span class="ml-1 font-mono text-fg-tertiary">{{ thresholdPct.toFixed(0) }}%</span>
                  </label>
                  <LSlider
                    :model-value="thresholdPct"
                    :min="0"
                    :max="100"
                    :step="1"
                    @update:value="(v) => (thresholdPct = Number(v))"
                  />
                </div>
                <div class="grid grid-cols-3 gap-2 rounded-md border border-border bg-canvas p-3">
                  <div>
                    <div class="text-[10px] font-medium uppercase text-fg-tertiary">Precision</div>
                    <div class="font-mono text-sm">{{ (thresholdSampleAt.precision * 100).toFixed(1) }}%</div>
                  </div>
                  <div>
                    <div class="text-[10px] font-medium uppercase text-fg-tertiary">Recall</div>
                    <div class="font-mono text-sm">{{ (thresholdSampleAt.recall * 100).toFixed(1) }}%</div>
                  </div>
                  <div>
                    <div class="text-[10px] font-medium uppercase text-fg-tertiary">F1</div>
                    <div class="font-mono text-sm">{{ (thresholdSampleAt.f1 * 100).toFixed(1) }}%</div>
                  </div>
                </div>
              </div>
            </div>
            <LEmpty
              v-else
              title="No threshold sweep recorded"
              description="Record samples via lumina.log_eval_summary(threshold_sweep=[{'threshold': .., 'precision': .., 'recall': .., 'f1': ..}, ...])."
            />
          </LCard>
        </LTabPane>

        <!-- ── Raw results ─────────────────────────────────────────────── -->
        <LTabPane name="results" tab="Raw Results">
          <LCard v-if="results && results.length > 0" class="p-0">
            <ul class="divide-y divide-border">
              <li
                v-for="r in results"
                :key="r.id"
                class="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span class="font-mono text-fg-tertiary">{{ r.key }}</span>
                <span class="font-mono">{{ r.value }}</span>
              </li>
            </ul>
          </LCard>
          <LCard v-else class="p-8">
            <LEmpty
              title="No per-result metrics yet"
              description="Call lumina.log_eval_result(key, value) to record per-key scalar metrics."
            />
          </LCard>
        </LTabPane>
      </LTabs>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Evaluation not found.
    </LCard>
  </div>
</template>
