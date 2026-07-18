<script setup lang="ts">
import { computed } from "vue";
import { getWidget } from "./registry";
import type { LayoutItem } from "./types";

interface Props {
  item: LayoutItem;
}

const props = defineProps<Props>();

const definition = computed(() => getWidget(props.item.type));
</script>

<template>
  <component
    :is="definition?.component"
    v-if="definition"
    :config="item.config"
    :id="item.id"
  />
  <div
    v-else
    class="flex h-full items-center justify-center rounded-md border border-dashed border-border bg-card p-4 text-sm text-muted-foreground"
  >
    Unknown widget: {{ item.type }}
  </div>
</template>
