<script setup lang="ts">
import { ref, h } from "vue";
import { RouterLink } from "vue-router";
import { LCard, LTag, LDataTable, LButton, LStatusBadge } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useTraces } from "@/modules/trace/composables/useTraces";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Trace } from "@/types/trace";

const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: traces, isLoading } = useTraces(
  ref({ limit: pageSize.value, offset: (page.value - 1) * pageSize.value }),
);

const columns: ColumnDef<Trace>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/traces/${row.original.id}`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => h(LStatusBadge, { status: row.original.status }),
  },
  {
    accessorKey: "spans",
    header: "Spans",
    cell: ({ row }) => row.original._count?.spans ?? 0,
  },
  {
    accessorKey: "startTime",
    header: "Start",
    cell: ({ row }) => formatDate(row.original.startTime),
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => {
      if (!row.original.endTime) return "—";
      const ms = new Date(row.original.endTime).getTime() - new Date(row.original.startTime).getTime();
      return `${(ms / 1000).toFixed(2)}s`;
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/traces/${row.original.id}` },
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
        <h1 class="text-2xl font-bold tracking-tight">Traces</h1>
        <p class="text-muted-foreground">LLM and agent traces across all projects.</p>
      </div>
    </div>

    <LCard class="p-0">
      <LDataTable
        :data="traces?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="traces?.total ?? 0"
      />
    </LCard>
  </div>
</template>