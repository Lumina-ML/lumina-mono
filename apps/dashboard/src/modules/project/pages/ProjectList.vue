<script setup lang="ts">
import { ref, h } from "vue";
import { RouterLink } from "vue-router";
import { NCard, NButton } from "naive-ui";
import type { ColumnDef } from "@tanstack/vue-table";
import DataTable from "@/components/DataTable.vue";
import { useProjects } from "@/modules/project/composables/useProjects";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Project } from "@/types/project";

const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: projects, isLoading } = useProjects(
  ref({ limit: pageSize.value, offset: (page.value - 1) * pageSize.value }),
);

const columns: ColumnDef<Project>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.id}`, class: "font-medium hover:underline" },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "displayName",
    header: "Display Name",
    cell: ({ row }) => row.original.displayName || "—",
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "—",
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
        { to: `/projects/${row.original.id}` },
        () => h(NButton, { size: "small" }, () => "View"),
      ),
  },
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Projects</h1>
        <p class="text-muted-foreground">Manage your ML projects.</p>
      </div>
    </div>

    <NCard>
      <DataTable
        :data="projects?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="projects?.total ?? 0"
      />
    </NCard>
  </div>
</template>
