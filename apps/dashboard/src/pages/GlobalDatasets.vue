<script setup lang="ts">
import { computed, ref, h } from "vue";
import { RouterLink } from "vue-router";
import { LCard, LTag, LDataTable, LButton, LEmpty } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useArtifacts } from "@/modules/artifact/composables/useArtifacts";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Artifact } from "@/types/artifact";

const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

// Datasets are an `Artifact` view filtered to `type="dataset"`. The server
// honours `?type=dataset` on the global artifacts endpoint, so this page is
// just a thin wrapper around `useArtifacts` with the filter baked in.
const params = computed(() => ({
  type: "dataset" as const,
  limit: pageSize.value,
  offset: (page.value - 1) * pageSize.value,
}));

const { data: artifacts, isLoading, isError } = useArtifacts(params);

const columns: ColumnDef<Artifact>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/artifacts/${row.original.id}`,
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
        {
          to: `/projects/${row.original.projectId}/artifacts/${row.original.id}`,
        },
        () => h(LButton, { size: "sm" }, () => "View"),
      ),
  },
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Datasets</h1>
        <p class="text-muted-foreground">
          Dataset artifacts across every project in this workspace.
        </p>
      </div>
      <LTag size="small" type="info">Filtered to type=dataset</LTag>
    </div>

    <LCard v-if="isError" class="p-4">
      <LEmpty
        title="Couldn't load datasets"
        description="The server may be unreachable. Check that the API key and base URL are valid."
      />
    </LCard>

    <LCard v-else class="p-0">
      <LDataTable
        :data="artifacts?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="artifacts?.total ?? 0"
      />
      <div
        v-if="!isLoading && (artifacts?.items.length ?? 0) === 0"
        class="px-4 pb-4"
      >
        <LEmpty
          title="No datasets yet"
          description="Log a dataset artifact (type=dataset) from your SDK to see it here."
        />
      </div>
    </LCard>
  </div>
</template>