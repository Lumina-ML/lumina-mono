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
  /* Mobile-first：小屏更紧凑 */
  --n-padding-left: 16px;
  --n-padding-right: 16px;
  --n-padding-top: 16px;
  --n-padding-bottom: 16px;
}

@media (min-width: 768px) {
  .l-card {
    --n-padding-left: 24px;
    --n-padding-right: 24px;
    --n-padding-top: 24px;
    --n-padding-bottom: 24px;
  }
}
</style>
