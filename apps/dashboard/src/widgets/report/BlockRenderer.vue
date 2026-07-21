<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { LCard, ChartRenderer, LSkeleton, LTag, LEmpty } from "@lumina/ui";
import type { ChartConfig } from "@lumina/ui";
import { MetricService } from "@/services/metric.service";
import { RunService } from "@/services/run.service";
import { colorForRunId } from "@/composables/useRunColor";
import type { Block } from "./blocks";
import { LMarkdown } from "@lumina/ui";

const props = defineProps<{
  block: Block;
}>();

// ── Chart block — fetch metric for the bound run ──────────────────────
const chartData = useQuery({
  queryKey: computed(() => ["block-chart", props.block.id, (props.block as { data?: { runId?: string; metricKey?: string } }).data?.runId]),
  enabled: computed(() => {
    if (props.block.type !== "chart") return false;
    const { runId, metricKey } = props.block.data;
    return !!runId && !!metricKey;
  }),
  queryFn: async () => {
    if (props.block.type !== "chart") return null;
    const { runId, metricKey } = props.block.data;
    const [resp, run] = await Promise.all([
      MetricService.list(runId, { limit: 2000 }),
      RunService.get(runId).catch(() => null),
    ]);
    const pts = resp.metrics[metricKey] ?? [];
    return {
      points: pts,
      runName: run?.name ?? runId.slice(0, 8),
      color: colorForRunId(runId),
    };
  },
});

const chartConfig = computed<ChartConfig | null>(() => {
  if (!chartData.data.value) return null;
  return {
    title: undefined,
    xAxis: { type: "value", name: "Step" },
    yAxis: { type: "value" },
    series: [
      {
        type: "line",
        name: chartData.data.value.runName,
        data: chartData.data.value.points.map(
          (p) => [p.step, p.value] as [number, number],
        ),
        smooth: true,
        color: chartData.data.value.color,
        lineWidth: 1.5,
      },
    ],
    tooltip: { trigger: "axis" },
    performance: { samplingThreshold: 2000 },
  };
});

// ── Render helpers per block type ────────────────────────────────────
const headingLevel = computed(() => {
  if (props.block.type === "heading1") return 1;
  if (props.block.type === "heading2") return 2;
  if (props.block.type === "heading3") return 3;
  return null;
});

const headingText = computed(() => {
  if (
    props.block.type === "heading1" ||
    props.block.type === "heading2" ||
    props.block.type === "heading3"
  ) {
    return props.block.data.text;
  }
  return "";
});

const paragraphText = computed(() => {
  if (props.block.type === "paragraph") return props.block.data.text;
  if (props.block.type === "callout") return props.block.data.text;
  return "";
});

const codeLang = computed(() => (props.block.type === "code" ? props.block.data.language : ""));
const codeSource = computed(() => (props.block.type === "code" ? props.block.data.source : ""));
</script>

<template>
  <!-- Headings -->
  <h1 v-if="headingLevel === 1" class="text-3xl font-bold">{{ headingText }}</h1>
  <h2 v-else-if="headingLevel === 2" class="text-2xl font-semibold">{{ headingText }}</h2>
  <h3 v-else-if="headingLevel === 3" class="text-xl font-semibold">{{ headingText }}</h3>

  <!-- Paragraph / callout -->
  <LMarkdown
    v-else-if="block.type === 'paragraph' && paragraphText"
    :source="paragraphText"
  />
  <div
    v-else-if="block.type === 'callout'"
    :class="[
      'rounded-md border p-3 text-sm',
      block.data.variant === 'warning' ? 'border-accent-warning/30 bg-accent-warning/10' :
      block.data.variant === 'success' ? 'border-accent-success/30 bg-accent-success/10' :
      block.data.variant === 'error' ? 'border-accent-danger/30 bg-accent-danger/10' :
      'border-accent-info/30 bg-accent-info/10',
    ]"
  >
    {{ paragraphText }}
  </div>

  <!-- Code -->
  <pre
    v-else-if="block.type === 'code'"
    class="overflow-x-auto rounded-md border border-border bg-canvas p-3 font-mono text-xs"
  ><code :class="`language-${codeLang}`">{{ codeSource }}</code></pre>

  <!-- Image — user-uploaded block content, not an avatar/photo of a
       named user. LAvatar's src+alt contract doesn't fit because the
       alt is free-form and there's no initials fallback. Allowed
       exception to the dashboard atom-only rule. -->
  <!-- eslint-disable-next-line vue/no-restricted-html-elements -->
  <figure v-else-if="block.type === 'image'" class="space-y-1">
    <!-- eslint-disable-next-line vue/no-restricted-html-elements -->
    <img
      v-if="block.data.src"
      :src="block.data.src"
      :alt="block.data.alt"
      class="max-w-full rounded-md border border-border"
    />
    <div
      v-else
      class="flex h-32 items-center justify-center rounded-md border border-dashed border-border text-xs text-fg-tertiary"
    >
      Image URL not set
    </div>
    <figcaption v-if="block.data.caption" class="text-center text-xs text-fg-tertiary">
      {{ block.data.caption }}
    </figcaption>
  </figure>

  <!-- Chart (read-only preview) -->
  <LCard v-else-if="block.type === 'chart'" class="p-3">
    <div class="mb-2 flex items-center gap-2">
      <LTag size="small" type="info">Chart block</LTag>
      <span class="font-mono text-[10px] text-fg-tertiary">
        run:{{ block.data.runId.slice(0, 12) }} · {{ block.data.metricKey }}
      </span>
    </div>
    <LSkeleton v-if="chartData.isLoading.value" class="h-40 w-full" />
    <ChartRenderer
      v-else-if="chartConfig"
      :config="chartConfig"
      height="220"
    />
    <LEmpty
      v-else
      class="py-4"
      description="Provide a run ID and metric key to render this chart."
    />
  </LCard>
</template>