<script setup lang="ts">
import { ref, h } from "vue";
import { RouterLink } from "vue-router";
import { LCard, LTag, LDataTable, LButton } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useModels } from "@/modules/registry-model/composables/useModels";
import { useDateFormat } from "@/composables/useDateFormat";
import type { RegistryModel } from "@/types/registry-model";

const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: models, isLoading } = useModels(
  ref({ limit: pageSize.value, offset: (page.value - 1) * pageSize.value }),
);

const columns: ColumnDef<RegistryModel>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/models/${row.original.id}`, class: "font-medium hover:underline" },
        () => row.original.name,
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
        { to: `/models/${row.original.id}` },
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
        <h1 class="text-2xl font-bold tracking-tight">Model Registry</h1>
        <p class="text-muted-foreground">Registered models with versioned artifacts.</p>
      </div>
      <RouterLink to="/registry?new=1">
        <LButton type="primary">+ Register Model</LButton>
      </RouterLink>
    </div>

    <LCard class="p-0">
      <LDataTable
        :data="models?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="models?.total ?? 0"
      />
    </LCard>
  </div>
</template>