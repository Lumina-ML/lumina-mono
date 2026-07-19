<script setup lang="ts">
import { NTag } from "naive-ui";

interface Props {
  type?: "default" | "primary" | "info" | "success" | "warning" | "error";
  size?: "small" | "medium" | "large";
  round?: boolean;
  closable?: boolean;
  disabled?: boolean;
  color?: { color?: string; textColor?: string; borderColor?: string };
}

defineProps<Props>();
</script>

<template>
  <NTag v-bind="$props">
    <slot />
  </NTag>
</template>
