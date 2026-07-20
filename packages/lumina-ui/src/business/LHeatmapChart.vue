<script setup lang="ts">
import { computed } from "vue";
import ChartRenderer from "../chart/ChartRenderer.vue";
import type { ChartConfig } from "../chart/types";

export interface LHeatmapChartProps {
  title?: string;
  xLabels: string[];
  yLabels: string[];
  data: Array<[number, number, number]>;
  height?: string;
}

const props = withDefaults(defineProps<LHeatmapChartProps>(), {
  height: "360px",
});

const config = computed<ChartConfig>(() => {
  const values = props.data.map((d) => d[2]);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;

  return {
    title: props.title,
    xAxis: {
      type: "category",
      data: props.xLabels,
      splitLine: true,
    },
    yAxis: {
      type: "category",
      data: props.yLabels,
      splitLine: true,
    },
    series: [
      {
        type: "heatmap",
        name: "value",
        data: props.data as Array<(number | string | null)[]>,
      },
    ],
    visualMap: { min, max },
    tooltip: { trigger: "item" },
    grid: {
      left: "10%",
      right: "10%",
      top: "15%",
      bottom: "15%",
      containLabel: true,
    },
  };
});
</script>

<template>
  <ChartRenderer :config="config" :height="height" />
</template>
