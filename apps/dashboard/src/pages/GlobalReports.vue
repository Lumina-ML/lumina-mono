<script setup lang="ts">
import { computed, ref, h } from "vue";
import { RouterLink } from "vue-router";
import { LCard, LDataTable, LButton, LEmpty } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useReports } from "@/modules/report/composables/useReports";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Report } from "@/types/report";

const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const params = computed(() => ({
  limit: pageSize.value,
  offset: (page.value - 1) * pageSize.value,
}));

const { data: reports, isLoading, isError } = useReports(params);

const columns: ColumnDef<Report>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/reports/${row.original.id}`,
          class: "font-medium hover:underline",
        },
        () => row.original.title,
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
    accessorKey: "createdBy",
    header: "Author",
    cell: ({ row }) => row.original.createdBy || "—",
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
        {
          to: `/projects/${row.original.projectId}/reports/${row.original.id}`,
        },
        () => h(LButton, { size: "sm" }, () => "Open"),
      ),
  },
];
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Reports</h1>
      <p class="text-muted-foreground">
        Every report across every project in this workspace.
      </p>
    </div>

    <LCard v-if="isError" class="p-4">
      <LEmpty
        title="Couldn't load reports"
        description="The server may be unreachable. Check that the API key and base URL are valid."
      />
    </LCard>

    <LCard v-else class="p-0">
      <LDataTable
        :data="reports?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="reports?.total ?? 0"
      />
      <div
        v-if="!isLoading && (reports?.items.length ?? 0) === 0"
        class="px-4 pb-4"
      >
        <LEmpty
          title="No reports yet"
          description="Create a report from a project's Reports tab to see it here."
        />
      </div>
    </LCard>
  </div>
</template>