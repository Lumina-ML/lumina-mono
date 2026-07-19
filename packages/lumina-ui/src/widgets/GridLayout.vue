<script setup lang="ts">
import { computed } from "vue";
import type { LayoutItem } from "./types";

interface Props {
  layout: LayoutItem[];
  columns?: number;
  rowHeight?: number;
  gap?: number;
}

const props = withDefaults(defineProps<Props>(), {
  columns: 12,
  rowHeight: 80,
  gap: 16,
});

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))`,
  gridAutoRows: `${props.rowHeight}px`,
  gap: `${props.gap}px`,
}));

function itemStyle(item: LayoutItem) {
  return {
    gridColumn: `${item.x + 1} / span ${Math.min(item.w, props.columns)}`,
    gridRow: `${item.y + 1} / span ${item.h}`,
  };
}
</script>

<template>
  <div class="grid" :style="gridStyle">
    <div
      v-for="item in layout"
      :key="item.id"
      class="min-w-0"
      :style="itemStyle(item)"
    >
      <slot :item="item" />
    </div>
  </div>
</template>
