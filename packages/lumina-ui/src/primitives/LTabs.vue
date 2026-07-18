<script setup lang="ts">
import { NTabs } from "naive-ui";

interface Props {
  value?: string | number;
  type?: "line" | "bar" | "card" | "segment";
  animated?: boolean;
  justifyContent?: "space-between" | "space-around" | "center" | "start" | "end";
}

defineProps<Props>();

defineEmits<{
  "update:value": [value: string | number];
}>();
</script>

<template>
  <NTabs
    v-bind="$props"
    @update:value="$emit('update:value', $event)"
  >
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name" />
    </template>
  </NTabs>
</template>
