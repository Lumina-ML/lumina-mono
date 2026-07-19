<script setup lang="ts">
import { ref, h } from "vue";
import { RouterLink } from "vue-router";
import { LCard, LTag, LDataTable, LButton } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useReports } from "@/modules/report/composables/useReports";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Report } from "@/types/report";

const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: reports, isLoading } = useReports(
  ref({ limit: pageSize.value, offset: (page.value - 1) * pageSize.value }),
);

const columns: ColumnDef<Report>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.projectId}/reports/${row.original.id}`, class: "font-medium hover:underline" },
        () => row.original.title,
      ),
  },
  {
    accessorKey: "createdBy",
    header: "Author",
    cell: ({ row }) => row.original.createdBy || "—",
  },
  {
    accessorKey: "blocks",
    header: "Blocks",
    cell: ({ row }) => row.original.blocks?.length ?? 0,
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => formatDate(row.original.updatedAt),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.projectId}/reports/${row.original.id}` },
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
        <h1 class="text-2xl font-bold tracking-tight">Reports</h1>
        <p class="text-muted-foreground">Run reports and notes across all projects.</p>
      </div>
    </div>

    <LCard class="p-0">
      <LDataTable
        :data="reports?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="reports?.total ?? 0"
      />
    </LCard>
  </div>
</template>