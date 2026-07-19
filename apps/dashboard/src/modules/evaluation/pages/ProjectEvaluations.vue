<script setup lang="ts">
import { computed, ref, h } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { LCard, LDataTable, LButton, LEmpty, LStatusBadge } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useEvaluations } from "@/modules/evaluation/composables/useEvaluations";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Evaluation } from "@/types/evaluation";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: evaluations, isLoading } = useEvaluations(
  computed(() => ({
    projectId: projectId.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  })),
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
    cell: ({ row }) =>
      h(LStatusBadge, { status: row.original.status as never }),
  },
  {
    accessorKey: "runId",
    header: "Run",
    cell: ({ row }) =>
      row.original.runId
        ? h(
            RouterLink,
            {
              to: `/projects/${row.original.projectId}/runs/${row.original.runId}`,
              class: "font-mono text-xs hover:underline",
            },
            () => row.original.runId!.slice(0, 8),
          )
        : "—",
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
</script>

<template>
  <LCard class="p-0">
    <LDataTable
      :data="evaluations?.items ?? []"
      :columns="columns"
      :loading="isLoading"
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="evaluations?.total ?? 0"
    />
    <div
      v-if="!isLoading && (evaluations?.items.length ?? 0) === 0"
      class="px-4 pb-4"
    >
      <LEmpty
        title="No evaluations yet"
        description="Run an evaluation against a model artifact to see results here."
      />
    </div>
  </LCard>
</template>