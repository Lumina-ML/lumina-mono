<script setup lang="ts">
import { ref, h } from "vue";
import { RouterLink } from "vue-router";
import { LCard, LTag, LDataTable, LButton } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useArtifacts } from "@/modules/artifact/composables/useArtifacts";
import { useDateFormat } from "@/composables/useDateFormat";
import QueryBoundary from "@/components/QueryBoundary.vue";
import type { Artifact, ArtifactType } from "@/types/artifact";

const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: artifacts, isLoading, isError, error, refetch } = useArtifacts(
  ref({ limit: pageSize.value, offset: (page.value - 1) * pageSize.value }),
);

const typeVariant: Record<ArtifactType, "default" | "primary" | "info" | "success" | "warning"> = {
  dataset: "info",
  model: "primary",
  checkpoint: "success",
  file: "default",
  table: "warning",
};

const columns: ColumnDef<Artifact>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.projectId}/artifacts`, class: "font-medium hover:underline" },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) =>
      h(LTag, { size: "small", type: typeVariant[row.original.type] }, () => row.original.type),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "—",
  },
  {
    accessorKey: "versions",
    header: "Versions",
    cell: ({ row }) => row.original._count?.versions ?? 0,
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
        { to: `/projects/${row.original.projectId}/artifacts` },
        () => h(LButton, { size: "sm" }, () => "View"),
      ),
  },
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Artifacts</h1>
        <p class="text-muted-foreground">Versioned files, datasets, and models across all projects.</p>
      </div>
    </div>

    <LCard class="p-0">
      <QueryBoundary
        :is-error="isError"
        :error="error"
        title="Couldn't load artifacts"
        @retry="refetch()"
      >
        <LDataTable
          :data="artifacts?.items ?? []"
          :columns="columns"
          :loading="isLoading"
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="artifacts?.total ?? 0"
        />
      </QueryBoundary>
    </LCard>
  </div>
</template>