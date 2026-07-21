<script setup lang="ts">
import { computed, ref, h } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  LCard,
  LTag,
  LSkeleton,
  LEmpty,
  LDataTable,
  LButton,
} from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { ArrowLeft, PackageOpen } from "lucide-vue-next";
import { RegistryService } from "@/services/registry.service";
import { useDateFormat } from "@/composables/useDateFormat";
import type { RegistryModelVersion } from "@/types/registry-model";

const route = useRoute();
const { formatDate } = useDateFormat();

const name = computed(() => route.params.name as string);

const { data: models, isLoading: modelsLoading } = useQuery({
  queryKey: ["registry-models", "by-name"],
  queryFn: () => RegistryService.list({ limit: 200 }),
});

const model = computed(() =>
  (models.value?.items ?? []).find((m) => m.name === name.value) ?? null,
);

const { data: versions, isLoading: versionsLoading } = useQuery({
  queryKey: computed(() => ["registry-model-versions", model.value?.id]),
  queryFn: async () => {
    if (!model.value) return [];
    return RegistryService.listVersions(model.value.id);
  },
  enabled: computed(() => !!model.value),
});

const page = ref(1);
const pageSize = ref(20);

const columns: ColumnDef<RegistryModelVersion>[] = [
  {
    accessorKey: "version",
    header: "Version",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/models/${encodeURIComponent(name.value)}/versions/${row.original.version}`,
          class: "font-medium hover:underline",
        },
        () => `v${row.original.version}`,
      ),
  },
  {
    accessorKey: "aliases",
    header: "Aliases",
    cell: ({ row }) =>
      row.original.aliases.length > 0
        ? h(
            "div",
            { class: "flex flex-wrap gap-1" },
            row.original.aliases.map((a) =>
              h(LTag, { key: a, size: "small", type: "primary" }, () => `@${a}`),
            ),
          )
        : "—",
  },
  {
    accessorKey: "artifactVersionId",
    header: "Artifact Version",
    cell: ({ row }) =>
      h(
        "span",
        { class: "font-mono text-xs text-fg-tertiary" },
        row.original.artifactVersionId.slice(0, 12),
      ),
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
        {
          to: `/models/${encodeURIComponent(name.value)}/versions/${row.original.version}`,
        },
        () => h(LButton, { size: "sm" }, () => "View"),
      ),
  },
];
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      to="/models"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to model registry
    </RouterLink>

    <LSkeleton v-if="modelsLoading" text :repeat="2" />

    <template v-else-if="model">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ model.name }}</h1>
        <p v-if="model.description" class="mt-1 text-sm text-fg-tertiary">
          {{ model.description }}
        </p>
      </div>

      <LCard class="p-0">
        <LSkeleton v-if="versionsLoading" class="p-8" :repeat="3" />
        <LDataTable
          v-else-if="(versions ?? []).length > 0"
          :data="versions ?? []"
          :columns="columns"
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="versions?.length ?? 0"
        />
        <LEmpty
          v-else
          class="p-12"
          title="No versions yet"
          description="Log models from your runs to see versions here."
        >
          <RouterLink :to="`/models/${encodeURIComponent(name)}/versions`">
            <LButton class="mt-2">
              <PackageOpen class="mr-1 h-3 w-3" />
              View model
            </LButton>
          </RouterLink>
        </LEmpty>
      </LCard>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Model not found.
    </LCard>
  </div>
</template>
