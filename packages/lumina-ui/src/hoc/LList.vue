<script setup lang="ts" generic="T">
import LSpinner from "../primitives/LSpinner.vue";
import LEmpty from "../primitives/LEmpty.vue";

export interface LListProps<T> {
  items?: T[];
  loading?: boolean;
  emptyDescription?: string;
  loadingText?: string;
  /** 唯一键字段名或 getter */
  keyProp?: keyof T | ((item: T) => string | number);
}

const props = withDefaults(defineProps<LListProps<T>>(), {
  items: () => [],
  emptyDescription: "No items",
});

function getKey(item: T, index: number): string | number {
  if (!props.keyProp) return index;
  if (typeof props.keyProp === "function") return props.keyProp(item);
  const value = item[props.keyProp];
  return value as string | number;
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
