<script setup lang="ts">
import { computed } from "vue";
import ChartRenderer from "../chart/ChartRenderer.vue";
import type { ChartConfig, ChartSeries } from "../chart/types";

export interface MetricSeries {
  name: string;
  data: Array<[number | string, number]>;
  color?: string;
}

export interface LMetricChartProps {
  title?: string;
  series: MetricSeries[];
  xAxisType?: "value" | "category" | "time";
  yAxisName?: string;
  xAxisName?: string;
  height?: string;
  smooth?: boolean;
  showArea?: boolean;
  showLegend?: boolean;
}

const props = withDefaults(defineProps<LMetricChartProps>(), {
  xAxisType: "value",
  height: "360px",
  smooth: true,
  showArea: false,
  showLegend: true,
});

const config = computed<ChartConfig>(() => {
  const series: ChartSeries[] = props.series.map((s) => ({
    type: props.showArea ? "area" : "line",
    name: s.name,
    data: s.data,
    color: s.color,
    smooth: props.smooth,
    showSymbol: false,
    areaOpacity: 0.1,
  }));

  return {
    title: props.title,
    xAxis: {
      type: props.xAxisType,
      name: props.xAxisName,
      splitLine: false,
    },
    yAxis: {
      type: "value",
      name: props.yAxisName,
      splitLine: { lineStyle: { type: "dashed" } },
    },
    series,
    legend: {
      show: props.showLegend,
      position: "bottom",
    },
    tooltip: {
      trigger: "axis",
      shared: true,
      crosshair: { type: "cross" },
    },
    grid: {
      left: "3%",
      right: "4%",
      top: "12%",
      bottom: "12%",
      containLabel: true,
    },
  };
});
</script>

<template>
  <ChartRenderer :config="config" :height="height" />
</template>
