<script setup lang="ts">
import { h } from "vue";
import { RouterLink } from "vue-router";
import { LButton, LDataTable } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import RunStatusBadge from "@/widgets/run-status-badge/RunStatusBadge.vue";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Run } from "@/types/run";

defineProps<{
  runs: Run[];
  loading?: boolean;
  total?: number;
}>();

const { formatDate, formatDurationMs } = useDateFormat();

const page = defineModel<number>("page", { default: 1 });
const pageSize = defineModel<number>("pageSize", { default: 20 });

const columns: ColumnDef<Run>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => h(RunStatusBadge, { status: row.original.status }),
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/runs/${row.original.runId}`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => {
      if (!row.original.finishedAt) return "—";
      const ms = new Date(row.original.finishedAt).getTime() - new Date(row.original.createdAt).getTime();
      return formatDurationMs(ms);
    },
  },
  {
    accessorKey: "metrics",
    header: "Metrics",
    cell: ({ row }) => row.original._count?.metrics ?? 0,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.projectId}/runs/${row.original.runId}` },
        () => h(LButton, { size: "sm" }, () => "View"),
      ),
  },
];
</script>

<template>
  <LDataTable
    :data="runs"
    :columns="columns"
    :loading="loading"
    v-model:page="page"
    v-model:page-size="pageSize"
    :total="total"
  />
</template>
