<script setup lang="ts">
import { computed } from "vue";
import { ChartRenderer } from "@lumina/ui";
import type { ChartConfig } from "@lumina/ui";
import type { PRPoint } from "./types";

const props = defineProps<{
  points: PRPoint[];
  /** Optional secondary series (e.g. baseline random classifier). */
  baseline?: PRPoint[];
  /** AUC-PR estimate; the widget computes its own if absent. */
  auc?: number;
  height?: number;
}>();

function aucPr(points: PRPoint[]): number {
  if (points.length === 0) return 0;
  let area = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.recall - points[i - 1]!.recall;
    const avgY = (points[i]!.precision + points[i - 1]!.precision) / 2;
    area += dx * avgY;
  }
  return Math.max(0, Math.min(1, area));
}

const computedAuc = computed(() =>
  props.auc != null ? props.auc : aucPr(props.points),
);

const chartConfig = computed<ChartConfig>(() => {
  const series: ChartConfig["series"] = [
    {
      type: "line",
      name: "PR curve",
      data: props.points.map(
        (p) => [p.recall, p.precision] as [number, number],
      ),
      smooth: true,
      showSymbol: props.points.length < 20,
      color: "#3b82f6",
      lineWidth: 2,
      areaOpacity: 0.15,
    },
  ];
  if (props.baseline && props.baseline.length > 0) {
    series.push({
      type: "line",
      name: "Baseline",
      data: props.baseline.map(
        (p) => [p.recall, p.precision] as [number, number],
      ),
      smooth: false,
      showSymbol: false,
      color: "#94a3b8",
      lineType: "dashed",
      lineWidth: 1,
    });
  }
  return {
    title: `PR Curve (AUC-PR = ${computedAuc.value.toFixed(3)})`,
    xAxis: {
      type: "value",
      name: "Recall",
      min: 0,
      max: 1,
      splitLine: { lineStyle: { type: "dashed" } },
    },
    yAxis: {
      type: "value",
      name: "Precision",
      min: 0,
      max: 1,
      splitLine: { lineStyle: { type: "dashed" } },
    },
    legend: {
      show: true,
      position: "bottom",
      type: "plain",
    },
    tooltip: {
      trigger: "axis",
      crosshair: { type: "cross" },
    },
    series,
  };
});
</script>

<template>
  <ChartRenderer :config="chartConfig" :height="String(height) ?? 320" />
</template>