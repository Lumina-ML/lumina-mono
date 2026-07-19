<script setup lang="ts">
import { NDataTable } from "naive-ui";
import type { DataTableColumns, DataTableProps } from "naive-ui";

export interface LTableProps<T = Record<string, unknown>> {
  data?: T[];
  columns?: DataTableColumns<T>;
  loading?: boolean;
  bordered?: boolean;
  striped?: boolean;
  size?: "small" | "medium" | "large";
  pagination?: DataTableProps["pagination"];
  rowKey?: DataTableProps["rowKey"];
  scrollX?: number | string;
  maxHeight?: number | string;
}

const props = defineProps<LTableProps>();
</script>

<template>
  <NDataTable
    :data="props.data"
    :columns="(props.columns as any)"
    :loading="props.loading"
    :bordered="props.bordered ?? false"
    :striped="props.striped"
    :size="props.size ?? 'medium'"
    :pagination="props.pagination"
    :row-key="props.rowKey"
    :scroll-x="props.scrollX"
    :max-height="props.maxHeight"
    class="l-table"
  />
</template>

<style scoped>
.l-table {
  --n-th-color: hsl(var(--muted) / 0.5);
  --n-th-color-hover: hsl(var(--muted));
  --n-td-color: hsl(var(--card));
  --n-td-color-hover: hsl(var(--muted) / 0.3);
  --n-border-color: hsl(var(--border));
}
</style>
