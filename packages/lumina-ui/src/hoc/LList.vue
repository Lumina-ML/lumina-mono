<script setup lang="ts">
import LSpinner from "../primitives/LSpinner.vue";
import LEmpty from "../primitives/LEmpty.vue";

export interface LListProps {
  items?: unknown[];
  loading?: boolean;
  emptyDescription?: string;
  loadingText?: string;
  /** 唯一键字段名 */
  keyProp?: string;
}

const props = withDefaults(defineProps<LListProps>(), {
  items: () => [],
  emptyDescription: "No items",
});

function getKey(item: unknown, index: number): string | number {
  if (!props.keyProp) return index;
  if (item && typeof item === "object" && props.keyProp in item) {
    return (item as Record<string, unknown>)[props.keyProp] as string | number;
  }
  return index;
}
</script>

<template>
  <div>
    <div v-if="loading" class="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
      <LSpinner />
      <span v-if="loadingText" class="text-sm">{{ loadingText }}</span>
    </div>

    <LEmpty v-else-if="!items?.length" :description="emptyDescription">
      <slot name="empty-extra" />
    </LEmpty>

    <template v-else>
      <slot
        v-for="(item, index) in items"
        :key="getKey(item, index)"
        :item="item"
        :index="index"
      />
    </template>
  </div>
</template>
