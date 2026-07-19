<script setup lang="ts">
import { computed } from "vue";
import { getWidget } from "./registry";
import type { LayoutItem } from "./types";

interface Props {
  item: LayoutItem;
  editable?: boolean;
}

const props = defineProps<Props>();

const definition = computed(() => getWidget(props.item.type));
</script>

<template>
  <div class="flex h-full flex-col rounded-md border border-border bg-card shadow-sm">
    <div
      class="widget-drag-handle flex cursor-grab items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5"
      :class="{ 'opacity-0': !editable }"
    >
      <span class="text-xs font-medium text-muted-foreground">
        {{ definition?.name ?? item.type }}
      </span>
      <span class="text-xs text-muted-foreground">⋮⋮</span>
    </div>
    <div class="flex-1 overflow-hidden p-3">
      <component
        :is="definition?.component"
        v-if="definition"
        :config="item.config"
        :id="item.id"
      />
      <div
        v-else
        class="flex h-full items-center justify-center text-sm text-muted-foreground"
      >
        Unknown widget: {{ item.type }}
      </div>
    </div>
  </div>
</template>
