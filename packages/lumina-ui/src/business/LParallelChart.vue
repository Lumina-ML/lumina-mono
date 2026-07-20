<script setup lang="ts">
import { computed } from "vue";
import ChartRenderer from "../chart/ChartRenderer.vue";
import type { ChartConfig, ChartParallelAxis } from "../chart/types";

export interface LParallelChartProps {
  title?: string;
  axes: ChartParallelAxis[];
  rows: Array<(string | number | null | undefined)[]>;
  height?: string;
}

const props = withDefaults(defineProps<LParallelChartProps>(), {
  height: "360px",
});

const config = computed<ChartConfig>(() => ({
  title: props.title,
  series: [
    {
      type: "parallel",
      name: "runs",
      data: props.rows as Array<(number | string | null)[]>,
      smooth: true,
    },
  ],
  parallelAxes: props.axes,
  tooltip: { trigger: "item" },
}));
</script>

<template>
  <ChartRenderer :config="config" :height="height" />
</template>
