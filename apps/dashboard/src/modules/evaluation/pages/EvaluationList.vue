<script setup lang="ts">
import { ref, h } from "vue";
import { RouterLink } from "vue-router";
import { LCard, LTag, LDataTable, LButton, LStatusBadge } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useEvaluations } from "@/modules/evaluation/composables/useEvaluations";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Evaluation } from "@/types/evaluation";

const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: evaluations, isLoading } = useEvaluations(
  ref({ limit: pageSize.value, offset: (page.value - 1) * pageSize.value }),
);

const columns: ColumnDef<Evaluation>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/evaluations/${row.original.id}`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => h(LStatusBadge, { status: row.original.status }),
  },
  {
    accessorKey: "runId",
    header: "Run",
    cell: ({ row }) => (row.original.runId ? "✓" : "—"),
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
        { to: `/projects/${row.original.projectId}/evaluations/${row.original.id}` },
        () => h(LButton, { size: "sm" }, () => "View"),
      ),
  },
];

void LTag;
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Evaluations</h1>
        <p class="text-muted-foreground">Model evaluation runs and metrics.</p>
      </div>
    </div>

    <LCard class="p-0">
      <LDataTable
        :data="evaluations?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="evaluations?.total ?? 0"
      />
    </LCard>
  </div>
</template>