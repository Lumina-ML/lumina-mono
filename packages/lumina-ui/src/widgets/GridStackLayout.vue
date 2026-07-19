<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { GridStack } from "gridstack";
import type { GridStackNode } from "gridstack";
import "gridstack/dist/gridstack.min.css";
import type { LayoutItem } from "./types";

interface Props {
  layout: LayoutItem[];
  columns?: number;
  rowHeight?: number | string;
  margin?: number | string;
  editable?: boolean;
  /** 小于该宽度切换为单列，默认 768 */
  oneColumnSize?: number;
}

const props = withDefaults(defineProps<Props>(), {
  columns: 12,
  rowHeight: 80,
  margin: 8,
  editable: true,
  oneColumnSize: 768,
});

const emit = defineEmits<{
  "update:layout": [layout: LayoutItem[]];
}>();

const gridRef = ref<HTMLElement | null>(null);
let grid: GridStack | null = null;

function syncLayoutFromGrid(items: GridStackNode[]): void {
  const updatedMap = new Map(items.map((i) => [String(i.id), i]));
  const newLayout = props.layout.map((item) => {
    const updated = updatedMap.get(item.id);
    if (updated) {
      return {
        ...item,
        x: updated.x ?? item.x,
        y: updated.y ?? item.y,
        w: updated.w ?? item.w,
        h: updated.h ?? item.h,
      };
    }
    return item;
  });
  emit("update:layout", newLayout);
}

onMounted(async () => {
  await nextTick();

  if (!gridRef.value) return;

  grid = GridStack.init(
    {
      column: props.columns,
      cellHeight: props.rowHeight,
      margin: props.margin,
      float: false,
      disableDrag: !props.editable,
      disableResize: !props.editable,
      draggable: { handle: ".widget-drag-handle" },
      columnOpts: {
        columnMax: props.columns,
        breakpoints: [
          { w: props.oneColumnSize, c: 1, layout: "list" },
        ],
      },
    },
    gridRef.value,
  );

  grid.on("change", (_event, items) => syncLayoutFromGrid(items));
});

onUnmounted(() => {
  grid?.destroy(false);
  grid = null;
});

watch(
  () => props.editable,
  (editable) => {
    if (!grid) return;
    if (editable) {
      grid.enable();
    } else {
      grid.disable();
    }
  },
);

watch(
  () => props.layout,
  (newLayout) => {
    if (!grid) return;
    // 外部更新 layout 时，用 GridStack API 同步位置，避免 Vue 重新渲染导致状态丢失
    for (const item of newLayout) {
      grid.update(`[gs-id="${item.id}"]`, {
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      });
    }
  },
  { deep: true },
);
</script>

<template>
  <div ref="gridRef" class="grid-stack">
    <div
      v-for="item in layout"
      :key="item.id"
      class="grid-stack-item"
      :gs-x="item.x"
      :gs-y="item.y"
      :gs-w="item.w"
      :gs-h="item.h"
      :gs-id="item.id"
    >
      <div class="grid-stack-item-content h-full">
        <slot :item="item" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-stack-item-content {
  overflow: hidden;
}
</style>
