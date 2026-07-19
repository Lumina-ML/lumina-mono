<script setup lang="ts">
import { computed, ref, h } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { LCard, LTag, LDataTable, LButton, LEmpty } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useArtifacts } from "@/modules/artifact/composables/useArtifacts";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Artifact, ArtifactType } from "@/types/artifact";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: artifacts, isLoading } = useArtifacts(
  computed(() => ({
    projectId: projectId.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  })),
);

const typeVariant: Record<
  ArtifactType,
  "default" | "primary" | "info" | "success" | "warning"
> = {
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
        {
          to: `/projects/${row.original.projectId}/artifacts/${row.original.id}`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) =>
      h(
        LTag,
        { size: "small", type: typeVariant[row.original.type] },
        () => row.original.type,
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
  <LCard class="p-0">
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
        title="No artifacts yet"
        description="Log artifacts from your runs to see them here."
      />
    </div>
  </LCard>
</template>