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

withDefaults(defineProps<Props>(), {
  round: true,
});
</script>

<template>
  <NTag v-bind="$props" class="l-tag">
    <slot />
  </NTag>
</template>

<style scoped>
.l-tag {
  --n-color: hsl(var(--muted));
  --n-text-color: hsl(var(--foreground));
  --n-border: 1px solid transparent;
  --n-border-radius: 9999px;
}
</style>
