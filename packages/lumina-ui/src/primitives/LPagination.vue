<script setup lang="ts">
import { NPagination } from "naive-ui";

interface Props {
  page?: number;
  pageSize?: number;
  itemCount?: number;
  pageSizes?: number[];
  showSizePicker?: boolean;
  showQuickJumper?: boolean;
  disabled?: boolean;
}

defineProps<Props>();

defineEmits<{
  "update:page": [page: number];
  "update:pageSize": [pageSize: number];
}>();
</script>

<template>
  <NPagination
    v-bind="$props"
    @update:page="$emit('update:page', $event)"
    @update:page-size="$emit('update:pageSize', $event)"
  />
</template>
