<script setup lang="ts">
import MetricChart from "@/widgets/metric-chart/MetricChart.vue";
import type { MetricPoint } from "@/types/metric";

interface Config {
  title?: string;
  metrics?: Record<string, MetricPoint[]>;
  height?: string;
}

const props = defineProps<{
  config?: Config;
}>();
</script>

<template>
  <MetricChart
    :metrics="props.config?.metrics ?? {}"
    :title="props.config?.title"
    :height="props.config?.height"
  />
</template>
