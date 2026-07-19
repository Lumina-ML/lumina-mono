<script setup lang="ts">
import { computed, ref, h } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { LCard, LTag, LDataTable, LButton, LEmpty } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { useTraces } from "@/modules/trace/composables/useTraces";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Trace } from "@/types/trace";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const { formatDate, formatDurationMs } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: traces, isLoading } = useTraces(
  computed(() => ({
    projectId: projectId.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  })),
);

function duration(t: Trace): string {
  if (!t.startTime) return "—";
  const start = new Date(t.startTime).getTime();
  const end = t.endTime ? new Date(t.endTime).getTime() : Date.now();
  return formatDurationMs(end - start);
}

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
    cell: ({ row }) =>
      h(LTag, { size: "small", type: "info" }, () => row.original.status),
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => duration(row.original),
  },
  {
    accessorKey: "spans",
    header: "Spans",
    cell: ({ row }) => row.original._count?.spans ?? 0,
  },
  {
    accessorKey: "startTime",
    header: "Started",
    cell: ({ row }) => formatDate(row.original.startTime),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.projectId}/traces/${row.original.id}` },
        () => h(LButton, { size: "sm" }, () => "Open"),
      ),
  },
];
</script>

<template>
  <LCard class="p-0">
    <LDataTable
      :data="traces?.items ?? []"
      :columns="columns"
      :loading="isLoading"
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="traces?.total ?? 0"
    />
    <div v-if="!isLoading && (traces?.items.length ?? 0) === 0" class="px-4 pb-4">
      <LEmpty
        title="No traces yet"
        description="Use Lumina's trace integration to record span timelines for runs in this project."
      />
    </div>
  </LCard>
</template>