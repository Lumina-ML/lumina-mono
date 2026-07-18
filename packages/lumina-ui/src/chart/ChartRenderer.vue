<script setup lang="ts">
import { computed } from "vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart, BarChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
} from "echarts/components";
import VChart from "vue-echarts";
import type { ChartConfig } from "./types";
import { toEChartsOption } from "./adapters/echarts";

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
]);

interface Props {
  config: ChartConfig;
  height?: string;
  autoresize?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  height: "360px",
  autoresize: true,
});

const option = computed(() => toEChartsOption(props.config));

const updateOptions = computed(() => ({
  lazyUpdate: props.config.performance?.lazyUpdate ?? false,
  notMerge: props.config.performance?.notMerge ?? false,
}));
</script>

<template>
  <VChart
    :option="option"
    :autoresize="autoresize"
    :update-options="updateOptions"
    :style="{ height, width: '100%' }"
  />
</template>
