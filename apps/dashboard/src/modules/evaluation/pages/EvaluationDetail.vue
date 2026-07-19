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
} from "@lumina/ui";
import { ArrowLeft, AlertTriangle } from "lucide-vue-next";
import { useEvaluation } from "@/modules/evaluation/composables/useEvaluations";
import { EvaluationService } from "@/services/evaluation.service";
import { useDateFormat } from "@/composables/useDateFormat";
import {
  syntheticConfusionMatrix,
  syntheticPRCurve,
  syntheticThresholdSamples,
  confusionMatrixStats,
  perClassMetrics,
} from "@/widgets/evaluation/useEvaluationViz";
import type { ConfusionMatrix } from "@/widgets/evaluation/types";
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

// ── Derive data ────────────────────────────────────────────────────────
// Accuracy from the recorded scalar results (if present), else from summary.
const summaryMetrics = computed(() => {
  const r = (results.value ?? []) as Array<{
    key: string;
    value: number;
  }>;
  const out: Record<string, number> = {};
  for (const x of r) out[x.key] = x.value;
  // Layer summary values underneath.
  const summary = (evaluation.value?.summary ?? {}) as Record<string, number>;
  for (const [k, v] of Object.entries(summary)) {
    if (typeof v === "number") out[k] = out[k] ?? v;
  }
  return out;
});

const accuracy = computed(() => {
  const a = summaryMetrics.value["accuracy"];
  if (typeof a === "number") return a;
  // Use f1 as a fallback.
  const f1 = summaryMetrics.value["f1"];
  if (typeof f1 === "number") return f1;
  return 0.85;
});

const numSamples = computed(() => {
  const n = summaryMetrics.value["num_samples"];
  return typeof n === "number" ? n : 1000;
});

const isRealMatrix = computed(() => {
  const summary = (evaluation.value?.summary ?? {}) as {
    confusion_matrix?: ConfusionMatrix;
  };
  return !!summary.confusion_matrix;
});

const confusionMatrix = computed<ConfusionMatrix>(() => {
  const summary = (evaluation.value?.summary ?? {}) as {
    confusion_matrix?: ConfusionMatrix;
  };
  if (summary.confusion_matrix) return summary.confusion_matrix;
  return syntheticConfusionMatrix(numSamples.value, accuracy.value);
});

const stats = computed(() => confusionMatrixStats(confusionMatrix.value));
const perClass = computed(() => perClassMetrics(confusionMatrix.value));

const prCurve = computed(() => {
  const summary = (evaluation.value?.summary ?? {}) as { pr_curve?: Array<{ recall: number; precision: number }> };
  if (summary.pr_curve) return summary.pr_curve;
  return syntheticPRCurve(50, accuracy.value);
});

const thresholdSamples = computed(() =>
  syntheticThresholdSamples(50, accuracy.value),
);

// ── Threshold slider ──────────────────────────────────────────────────
const thresholdPct = ref(50);
const thresholdSamplesAt = computed(() => {
  const samples = thresholdSamples.value;
  const idx = Math.min(
    samples.length - 1,
    Math.round((thresholdPct.value / 100) * (samples.length - 1)),
  );
  return samples[idx]!;
});

const statusVariant = computed(() => {
  const s = evaluation.value?.status;
  if (s === "completed") return "success" as const;
  if (s === "running") return "info" as const;
  if (s === "failed") return "error" as const;
  return "default" as const;
});
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

      <div
        v-if="!isRealMatrix"
        class="flex items-start gap-2 rounded-md border border-accent-warning/30 bg-accent-warning/10 p-3 text-xs"
      >
        <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-warning" />
        <div>
          <div class="font-medium">Synthetic visualization</div>
          <div class="text-fg-tertiary">
            Backend doesn't expose a structured confusion matrix for this
            evaluation. Showing a derived preview; wire the eval pipeline to
            record <code class="font-mono">summary.confusion_matrix</code> for
            live data.
          </div>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LCard class="p-4">
          <LStatistic
            label="Accuracy"
            :value="`${(stats.accuracy * 100).toFixed(1)}%`"
          />
          <div class="mt-1 font-mono text-[10px] text-fg-tertiary">
            {{ stats.correct }} / {{ stats.total }} correct
          </div>
        </LCard>
        <LCard class="p-4">
          <LStatistic
            label="Macro F1"
            :value="`${(perClass.reduce((a, x) => a + x.f1, 0) / Math.max(1, perClass.length) * 100).toFixed(1)}%`"
          />
        </LCard>
        <LCard class="p-4">
          <LStatistic label="Classes" :value="String(perClass.length)" />
        </LCard>
        <LCard class="p-4">
          <LStatistic label="Samples" :value="String(stats.total)" />
        </LCard>
      </div>

      <LTabs type="line" animated>
        <LTabPane name="overview" tab="Overview">
          <ConfusionMatrixView :matrix="confusionMatrix" />
        </LTabPane>

        <LTabPane name="metrics" tab="Metrics">
          <MetricsTable :rows="perClass" />
        </LTabPane>

        <LTabPane name="pr" tab="PR Curve">
          <LCard class="p-4">
            <PRCurveView :points="prCurve" :height="380" />
          </LCard>
        </LTabPane>

        <LTabPane name="threshold" tab="Threshold">
          <LCard class="p-4">
            <div class="grid gap-6 lg:grid-cols-[1fr_300px]">
              <div>
                <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
                  Threshold sweep
                </h3>
                <PRCurveView
                  :points="thresholdSamples.map((s) => ({ recall: s.recall, precision: s.precision }))"
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
                    <div class="font-mono text-sm">{{ (thresholdSamplesAt.precision * 100).toFixed(1) }}%</div>
                  </div>
                  <div>
                    <div class="text-[10px] font-medium uppercase text-fg-tertiary">Recall</div>
                    <div class="font-mono text-sm">{{ (thresholdSamplesAt.recall * 100).toFixed(1) }}%</div>
                  </div>
                  <div>
                    <div class="text-[10px] font-medium uppercase text-fg-tertiary">F1</div>
                    <div class="font-mono text-sm">{{ (thresholdSamplesAt.f1 * 100).toFixed(1) }}%</div>
                  </div>
                </div>
              </div>
            </div>
          </LCard>
        </LTabPane>

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
              description="Call /evaluations/:id/results to record per-key scalar metrics."
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