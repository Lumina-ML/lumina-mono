<script setup lang="ts">
import { NTree } from "naive-ui";
import type { TreeOption } from "naive-ui";

export interface LTreeProps {
  data?: TreeOption[];
  selectedKeys?: string[];
  expandedKeys?: string[];
  checkedKeys?: string[];
  checkable?: boolean;
  selectable?: boolean;
  cascade?: boolean;
  defaultExpandAll?: boolean;
  blockLine?: boolean;
  virtualScroll?: boolean;
}

const props = withDefaults(defineProps<LTreeProps>(), {
  data: () => [],
  selectable: true,
  blockLine: true,
});

defineEmits<{
  "update:selectedKeys": [keys: string[]];
  "update:expandedKeys": [keys: string[]];
  "update:checkedKeys": [keys: string[]];
}>();
</script>

<template>
  <NTree
    :data="(props.data as any)"
    :selected-keys="props.selectedKeys"
    :expanded-keys="props.expandedKeys"
    :checked-keys="props.checkedKeys"
    :checkable="props.checkable"
    :selectable="props.selectable"
    :cascade="props.cascade"
    :default-expand-all="props.defaultExpandAll"
    :block-line="props.blockLine"
    :virtual-scroll="props.virtualScroll"
    @update:selected-keys="$emit('update:selectedKeys', $event)"
    @update:expanded-keys="$emit('update:expandedKeys', $event)"
    @update:checked-keys="$emit('update:checkedKeys', $event)"
  />
</template>
