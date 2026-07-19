<script setup lang="ts">
import { ref, h } from "vue";
import { RouterLink } from "vue-router";
import { LCard, LTag, LDataTable, LButton, LStatusBadge } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useSweeps } from "@/modules/sweep/composables/useSweeps";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Sweep, SweepState, SweepMethod } from "@/types/sweep";

const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: sweeps, isLoading } = useSweeps(
  ref({ limit: pageSize.value, offset: (page.value - 1) * pageSize.value }),
);

const stateTypeMap: Record<SweepState, "default" | "info" | "success" | "warning" | "error"> = {
  pending: "default",
  running: "info",
  finished: "success",
  crashed: "error",
  cancelled: "warning",
};

const methodColorMap: Record<SweepMethod, string> = {
  random: "default",
  grid: "info",
  bayes: "primary",
};

const columns: ColumnDef<Sweep>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.projectId}/sweeps/${row.original.id}`, class: "font-medium hover:underline" },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }) =>
      h(LStatusBadge, { status: row.original.state as never }),
  },
  {
    accessorKey: "method",
    header: "Method",
    cell: ({ row }) =>
      h(LTag, { size: "small", type: methodColorMap[row.original.method] as never }, () =>
        row.original.method,
      ),
  },
  {
    accessorKey: "bestRunId",
    header: "Best Run",
    cell: ({ row }) => (row.original.bestRunId ? "✓" : "—"),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.projectId}/sweeps/${row.original.id}` },
        () => h(LButton, { size: "sm" }, () => "View"),
      ),
  },
];

// silence unused
void stateTypeMap;
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Sweeps</h1>
        <p class="text-muted-foreground">Hyperparameter search jobs across all projects.</p>
      </div>
    </div>

    <LCard class="p-0">
      <LDataTable
        :data="sweeps?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="sweeps?.total ?? 0"
      />
    </LCard>
  </div>
</template>