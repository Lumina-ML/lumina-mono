<script setup lang="ts">
import { computed } from "vue";
import {
  useVueTable,
  FlexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/vue-table";
import { NEmpty, NPagination } from "naive-ui";

const props = defineProps<{
  data: unknown[];
  columns: ColumnDef<any, any>[];
  loading?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
}>();

const emit = defineEmits<{
  "update:page": [page: number];
  "update:pageSize": [pageSize: number];
}>();

const sorting = defineModel<SortingState>("sorting", { default: () => [] });

const table = useVueTable({
  get data() {
    return props.data;
  },
  get columns() {
    return props.columns;
  },
  state: {
    get sorting() {
      return sorting.value;
    },
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === "function" ? updater(sorting.value) : updater;
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  manualSorting: true,
});

const showPagination = computed(() => props.total !== undefined && props.total > 0);
</script>

<template>
  <div class="rounded-md border border-border overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-muted">
          <tr
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            class="border-b border-border"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="h-10 px-4 text-left align-middle font-medium text-muted-foreground"
            >
              <FlexRender
                v-if="!header.isPlaceholder"
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" class="border-b border-border">
            <td :colspan="table.getAllColumns().length" class="p-8 text-center text-muted-foreground">
              Loading...
            </td>
          </tr>
          <tr v-else-if="data.length === 0" class="border-b border-border">
            <td :colspan="table.getAllColumns().length" class="p-8">
              <NEmpty description="No data available" />
            </td>
          </tr>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            class="border-b border-border hover:bg-muted/50 transition-colors"
          >
            <td v-for="cell in row.getVisibleCells()" :key="cell.id" class="p-4 align-middle">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showPagination" class="flex items-center justify-between p-4 border-t border-border">
      <div class="text-sm text-muted-foreground">
        Total: {{ total }}
      </div>
      <NPagination
        :page="page"
        :page-size="pageSize"
        :item-count="total"
        :page-sizes="[10, 20, 50, 100]"
        show-size-picker
        @update:page="emit('update:page', $event)"
        @update:page-size="emit('update:pageSize', $event)"
      />
    </div>
  </div>
</template>
