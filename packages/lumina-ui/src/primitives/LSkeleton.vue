<script setup lang="ts">
import { NSkeleton } from "naive-ui";

interface Props {
  text?: boolean;
  circle?: boolean;
  round?: boolean;
  size?: "small" | "medium" | "large";
  repeat?: number;
  animated?: boolean;
  sharp?: boolean;
  width?: string | number;
  height?: string | number;
}

defineProps<Props>();
</script>

<template>
  <NSkeleton v-bind="$props" />
</template>
