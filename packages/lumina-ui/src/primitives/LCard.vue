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
  <NCard v-bind="$props">
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name" />
    </template>
  </NCard>
</template>
