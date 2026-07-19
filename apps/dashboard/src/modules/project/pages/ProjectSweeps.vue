<script setup lang="ts">
import { computed, ref, h } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { LCard, LTag, LDataTable, LButton, LEmpty } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useSweeps } from "@/modules/sweep/composables/useSweeps";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Sweep, SweepMethod } from "@/types/sweep";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: sweeps, isLoading } = useSweeps(
  computed(() => ({
    projectId: projectId.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  })),
);

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
  <LCard class="p-0">
    <LDataTable
      :data="sweeps?.items ?? []"
      :columns="columns"
      :loading="isLoading"
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="sweeps?.total ?? 0"
    />
    <div v-if="!isLoading && (sweeps?.items.length ?? 0) === 0" class="px-4 pb-4">
      <LEmpty
        title="No sweeps yet"
        description="Sweeps run hyperparameter search jobs across multiple runs."
      />
    </div>
  </LCard>
</template>