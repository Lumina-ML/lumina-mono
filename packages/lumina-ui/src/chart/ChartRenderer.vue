<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
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
  ToolboxComponent,
  BrushComponent,
} from "echarts/components";
import VChart from "vue-echarts";
import type { ChartConfig } from "./types";
import { toEChartsOption } from "./adapters/echarts";
import { useChartThemeColors } from "./theme";
import LIconButton from "../primitives/LIconButton.vue";

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
  ToolboxComponent,
  BrushComponent,
]);

interface Props {
  config: ChartConfig;
  height?: string;
  autoresize?: boolean;
  /** 是否显示全屏按钮，默认 true */
  showFullscreen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  height: "360px",
  autoresize: true,
  showFullscreen: true,
});

const emit = defineEmits<{
  /** 框选完成时触发 */
  brush: [range: { start: number; end: number }[]];
}>();

const chartRef = ref<InstanceType<typeof VChart> | null>(null);
const wrapperRef = ref<HTMLDivElement | null>(null);
const isFullscreen = ref(false);

const { colors: themeColors } = useChartThemeColors();

const option = computed(() => toEChartsOption(props.config, themeColors.value));

const updateOptions = computed(() => ({
  lazyUpdate: props.config.performance?.lazyUpdate ?? false,
  notMerge: props.config.performance?.notMerge ?? false,
}));

function handleBrushEnd(params: any) {
  const areas = params?.batch?.[0]?.areas ?? params?.areas ?? [];
  const ranges = areas
    .map((area: any) => {
      if (area.coordRange) {
        return { start: area.coordRange[0], end: area.coordRange[1] };
      }
      return undefined;
    })
    .filter(Boolean);
  if (ranges.length) emit("brush", ranges);
}

async function toggleFullscreen() {
  const el = wrapperRef.value;
  if (!el) return;

  try {
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    // 浏览器不支持全屏或权限被拒时静默失败
  }
}

function onFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === wrapperRef.value;
  // 全屏切换后尺寸变化需要手动触发重绘
  chartRef.value?.resize();
}

if (typeof document !== "undefined") {
  document.addEventListener("fullscreenchange", onFullscreenChange);
  onScopeDispose(() => {
    document.removeEventListener("fullscreenchange", onFullscreenChange);
  });
}

watch(
  () => props.config.brush,
  () => {
    // brush 配置变化后，清除之前残留的选区，避免状态不一致
    chartRef.value?.dispatchAction?.({ type: "brush", areas: [] });
  },
  { flush: "post" },
);
</script>

<template>
  <div ref="wrapperRef" class="relative h-full w-full">
    <VChart
      ref="chartRef"
      :option="option"
      :autoresize="autoresize"
      :update-options="updateOptions"
      :style="{ height, width: '100%' }"
      @brush-end="handleBrushEnd"
    />
    <div
      v-if="showFullscreen"
      class="fullscreen-trigger absolute right-2 top-2 z-10"
      :class="{ 'opacity-100': isFullscreen }"
    >
      <LIconButton aria-label="Toggle fullscreen" @click="toggleFullscreen">
        <svg
          v-if="!isFullscreen"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="4 14 10 14 10 20" />
          <polyline points="20 10 14 10 14 4" />
          <line x1="14" y1="10" x2="21" y2="3" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </LIconButton>
    </div>
  </div>
</template>

<style scoped>
.fullscreen-trigger {
  opacity: 0;
  transition: opacity 150ms ease;
}

.relative:hover .fullscreen-trigger,
.fullscreen-trigger.opacity-100 {
  opacity: 1;
}
</style>
