<script setup lang="ts">
import { computed } from "vue";
import type { Component } from "vue";

export interface LIconProps {
  /** 图标组件，例如 lucide-vue-next 的图标 */
  icon?: Component;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  class?: string;
}

const props = defineProps<LIconProps>();

const sizeClasses = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
};

const classes = computed(() => [
  sizeClasses[props.size ?? "md"],
  "shrink-0",
  props.class,
]);
</script>

<template>
  <component :is="props.icon" v-if="props.icon" :class="classes" aria-hidden="true" />
</template>
