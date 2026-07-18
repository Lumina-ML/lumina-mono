<script setup lang="ts">
import { computed } from "vue";
import { ChartRenderer } from "@lumina/ui";
import type { ChartConfig } from "@lumina/ui";
import type { MetricPoint } from "@/types/metric";

const props = defineProps<{
  metrics: Record<string, MetricPoint[]>;
  title?: string;
  height?: string;
}>();

const config = computed<ChartConfig>(() => ({
  title: props.title,
  xAxis: {
    type: "value",
    name: "Step",
    splitLine: false,
  },
  yAxis: {
    type: "value",
    splitLine: { lineStyle: { type: "dashed" } },
  },
  legend: {
    position: "bottom",
    type: "scroll",
  },
  tooltip: {
    trigger: "axis",
    crosshair: { type: "cross" },
  },
  dataZoom: [
    { type: "inside", xAxisIndex: 0 },
    { type: "slider", xAxisIndex: 0 },
  ],
  series: Object.entries(props.metrics).map(([name, points]) => ({
    type: "line",
    name,
    data: points.map((p) => [p.step, p.value]),
    smooth: true,
  })),
  performance: {
    samplingThreshold: 2_000,
  },
}));
</script>

<template>
  <ChartRenderer :config="config" :height="height" />
</template>
