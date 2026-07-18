<script setup lang="ts">
import { computed } from "vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
} from "echarts/components";
import VChart from "vue-echarts";
import type { MetricPoint } from "@/types/metric";

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
]);

const props = defineProps<{
  metrics: Record<string, MetricPoint[]>;
  title?: string;
  height?: string;
}>();

const series = computed(() => {
  return Object.entries(props.metrics).map(([key, points]) => ({
    name: key,
    type: "line",
    smooth: true,
    showSymbol: false,
    data: points.map((p) => [p.step, p.value]),
  }));
});

const option = computed(() => ({
  backgroundColor: "transparent",
  title: props.title
    ? {
        text: props.title,
        left: "center",
        textStyle: { fontSize: 14, fontWeight: "normal" },
      }
    : undefined,
  tooltip: {
    trigger: "axis",
    axisPointer: { type: "cross" },
  },
  legend: {
    bottom: 0,
    type: "scroll",
  },
  grid: {
    left: "3%",
    right: "4%",
    bottom: "15%",
    top: "15%",
    containLabel: true,
  },
  xAxis: {
    type: "value",
    name: "Step",
    splitLine: { show: false },
  },
  yAxis: {
    type: "value",
    splitLine: { lineStyle: { type: "dashed" } },
  },
  dataZoom: [
    { type: "inside", xAxisIndex: 0 },
    { type: "slider", xAxisIndex: 0, bottom: 35, height: 20 },
  ],
  series: series.value,
}));
</script>

<template>
  <VChart
    :option="option"
    autoresize
    :style="{ height: height ?? '360px', width: '100%' }"
  />
</template>
