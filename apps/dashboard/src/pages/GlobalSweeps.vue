<script setup lang="ts">
import { computed, ref, h } from "vue";
import { RouterLink } from "vue-router";
import { LCard, LTag, LDataTable, LButton, LEmpty } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useSweeps } from "@/modules/sweep/composables/useSweeps";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Sweep, SweepMethod } from "@/types/sweep";

const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const params = computed(() => ({
  limit: pageSize.value,
  offset: (page.value - 1) * pageSize.value,
}));

const { data: sweeps, isLoading, isError } = useSweeps(params);

const methodColorMap: Record<SweepMethod, "default" | "info" | "primary"> = {
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
        {
          to: `/projects/${row.original.projectId}/sweeps/${row.original.id}`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "projectId",
    header: "Project",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}`,
          class: "font-mono text-xs hover:underline",
        },
        () => row.original.projectId.slice(0, 8),
      ),
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }) => row.original.state,
  },
  {
    accessorKey: "method",
    header: "Method",
    cell: ({ row }) =>
      h(
        LTag,
        { size: "small", type: methodColorMap[row.original.method] },
        () => row.original.method,
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
        {
          to: `/projects/${row.original.projectId}/sweeps/${row.original.id}`,
        },
        () => h(LButton, { size: "sm" }, () => "View"),
      ),
  },
];
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Sweeps</h1>
      <p class="text-muted-foreground">
        Every hyperparameter sweep across this workspace.
      </p>
    </div>

    <LCard v-if="isError" class="p-4">
      <LEmpty
        title="Couldn't load sweeps"
        description="The server may be unreachable. Check that the API key and base URL are valid."
      />
    </LCard>

    <LCard v-else class="p-0">
      <LDataTable
        :data="sweeps?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="sweeps?.total ?? 0"
      />
      <div
        v-if="!isLoading && (sweeps?.items.length ?? 0) === 0"
        class="px-4 pb-4"
      >
        <LEmpty
          title="No sweeps yet"
          description="Start a sweep from the SDK to see it here."
        />
      </div>
    </LCard>
  </div>
</template>