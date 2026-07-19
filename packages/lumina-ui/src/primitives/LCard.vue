<script setup lang="ts">
import { NCard } from "naive-ui";

interface Props {
  title?: string;
  bordered?: boolean;
  hoverable?: boolean;
  size?: "small" | "medium" | "large" | "huge";
  segmented?: boolean;
}

defineProps<Props>();
</script>

<template>
  <NCard v-bind="$props" class="l-card">
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name" />
    </template>
  </NCard>
</template>

<style scoped>
.l-card {
  --n-color: hsl(var(--card));
  --n-text-color: hsl(var(--card-foreground));
  --n-border-color: hsl(var(--border));
  --n-border-radius: var(--radius);
  --n-box-shadow: none;

  /* Mobile-first：小屏更紧凑 */
  --n-padding-left: 16px;
  --n-padding-right: 16px;
  --n-padding-top: 8px;
  --n-padding-bottom: 8px;
}

@media (min-width: 768px) {
  .l-card {
    --n-padding-left: 20px;
    --n-padding-right: 20px;
    --n-padding-top: 20px;
    --n-padding-bottom: 20px;
  }
}
</style>
