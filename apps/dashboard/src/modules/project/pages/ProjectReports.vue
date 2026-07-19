<script setup lang="ts">
import { computed, ref, h } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { LCard, LDataTable, LButton, LEmpty } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useReports } from "@/modules/report/composables/useReports";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Report } from "@/types/report";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: reports, isLoading } = useReports(
  computed(() => ({
    projectId: projectId.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  })),
);

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
  <LCard class="p-0">
    <LDataTable
      :data="reports?.items ?? []"
      :columns="columns"
      :loading="isLoading"
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="reports?.total ?? 0"
    />
    <div v-if="!isLoading && (reports?.items.length ?? 0) === 0" class="px-4 pb-4">
      <LEmpty
        title="No reports yet"
        description="Reports are shareable documents that combine runs, charts, and markdown."
      />
    </div>
  </LCard>
</template>