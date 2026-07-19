<script setup lang="ts">
import { NTabPane } from "naive-ui";

interface Props {
  name: string | number;
  tab?: string;
  disabled?: boolean;
}

defineProps<Props>();
</script>

<template>
  <NTabPane v-bind="$props">
    <slot />
  </NTabPane>
</template>
