<script setup lang="ts">
import { computed, ref, watch, h } from "vue";
import {
  useVueTable,
  FlexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/vue-table";
import { useVirtualizer } from "@tanstack/vue-virtual";
import LEmpty from "../primitives/LEmpty.vue";
import LPagination from "../primitives/LPagination.vue";
import LCheckbox from "../primitives/LCheckbox.vue";

export interface LDataTableProps {
  data: any[];
  columns: ColumnDef<any, any>[];
  loading?: boolean;
  enableRowSelection?: boolean;
  enableVirtualization?: boolean;
  virtualHeight?: number | string;
  virtualRowHeight?: number;
  rowSelection?: RowSelectionState;
  sorting?: SortingState;
  page?: number;
  pageSize?: number;
  total?: number;
  pageSizes?: number[];
  getRowId?: (row: any) => string;
}

const props = withDefaults(defineProps<LDataTableProps>(), {
  loading: false,
  enableRowSelection: false,
  enableVirtualization: false,
  virtualHeight: 400,
  virtualRowHeight: 40,
  rowSelection: () => ({}),
  sorting: () => [],
  pageSizes: () => [10, 20, 50, 100],
});

const emit = defineEmits<{
  "update:rowSelection": [value: RowSelectionState];
  "update:sorting": [value: SortingState];
  "update:page": [page: number];
  "update:pageSize": [pageSize: number];
}>();

const rowSelection = computed<RowSelectionState>({
  get: () => props.rowSelection ?? {},
  set: (value) => emit("update:rowSelection", value),
});

const sorting = computed<SortingState>({
  get: () => props.sorting ?? [],
  set: (value) => emit("update:sorting", value),
});

const tableColumns = computed<ColumnDef<any, any>[]>(() => {
  if (!props.enableRowSelection) return props.columns;
  const selectionColumn: ColumnDef<any, any> = {
    id: "select",
    header: ({ table }) =>
      h(LCheckbox, {
        checked: table.getIsAllRowsSelected(),
        indeterminate: table.getIsSomeRowsSelected(),
        "onUpdate:checked": (value: boolean) => table.toggleAllRowsSelected(value),
      }),
    cell: ({ row }) =>
      h(LCheckbox, {
        checked: row.getIsSelected(),
        "onUpdate:checked": (value: boolean) => row.toggleSelected(value),
      }),
    size: 40,
    enableSorting: false,
  };
  return [selectionColumn, ...props.columns];
});

const table = useVueTable({
  get data() {
    return props.data;
  },
  get columns() {
    return tableColumns.value;
  },
  getRowId: props.getRowId,
  state: {
    get rowSelection() {
      return rowSelection.value;
    },
    get sorting() {
      return sorting.value;
    },
  },
  onRowSelectionChange: (updater) => {
    rowSelection.value =
      typeof updater === "function" ? updater(rowSelection.value) : updater;
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === "function" ? updater(sorting.value) : updater;
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  manualSorting: true,
  get enableRowSelection() {
    return props.enableRowSelection;
  },
});

const rows = computed(() => table.getRowModel().rows);

const showPagination = computed(() => props.total !== undefined && props.total > 0);

const virtualHeightStyle = computed(() => {
  const height = props.virtualHeight;
  return typeof height === "number" ? `${height}px` : height;
});

const tableContainerRef = ref<HTMLElement | null>(null);

const virtualizer = useVirtualizer({
  get count() {
    return rows.value.length;
  },
  getScrollElement: () => tableContainerRef.value,
  estimateSize: () => props.virtualRowHeight,
  overscan: 10,
});

watch(
  () => rows.value.length,
  () => virtualizer.value.measure(),
);

function handlePageUpdate(page: number) {
  emit("update:page", page);
}

function handlePageSizeUpdate(pageSize: number) {
  emit("update:pageSize", pageSize);
}
</script>

<template>
  <div class="rounded-md border border-border overflow-hidden">
    <template v-if="enableVirtualization">
      <div
        v-if="loading"
        class="flex items-center justify-center text-sm text-muted-foreground"
        :style="{ height: virtualHeightStyle }"
      >
        Loading...
      </div>
      <div
        v-else-if="data.length === 0"
        class="flex items-center justify-center"
        :style="{ height: virtualHeightStyle }"
      >
        <LEmpty description="No data available" />
      </div>
      <div
        v-else
        ref="tableContainerRef"
        class="overflow-auto"
        :style="{ height: virtualHeightStyle }"
      >
        <table class="w-full text-sm" style="display: grid;">
          <thead class="bg-muted" style="display: grid; position: sticky; top: 0; z-index: 10;">
            <tr
              v-for="headerGroup in table.getHeaderGroups()"
              :key="headerGroup.id"
              class="border-b border-border"
              style="display: flex; width: 100%;"
            >
              <th
                v-for="header in headerGroup.headers"
                :key="header.id"
                class="h-10 px-4 text-left align-middle font-medium text-muted-foreground"
                :style="{ width: `${header.getSize()}px` }"
              >
                <div
                  class="flex items-center gap-1"
                  :class="header.column.getCanSort() ? 'cursor-pointer select-none' : ''"
                  @click="header.column.getToggleSortingHandler()?.($event)"
                >
                  <FlexRender
                    v-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                  <svg
                    v-if="header.column.getIsSorted() === 'asc'"
                    class="h-4 w-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m18 15-6-6-6 6" />
                  </svg>
                  <svg
                    v-else-if="header.column.getIsSorted() === 'desc'"
                    class="h-4 w-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </th>
            </tr>
          </thead>
          <tbody
            :style="{
              display: 'grid',
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
            }"
          >
            <tr
              v-for="virtualRow in virtualizer.getVirtualItems()"
              :key="rows[virtualRow.index].id"
              class="border-b border-border hover:bg-muted/50 transition-colors"
              :style="{
                display: 'flex',
                position: 'absolute',
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
              }"
            >
              <td
                v-for="cell in rows[virtualRow.index].getVisibleCells()"
                :key="cell.id"
                class="p-4 align-middle"
                :style="{ width: `${cell.column.getSize()}px` }"
              >
                <FlexRender
                  :render="cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
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
                <div
                  class="flex items-center gap-1"
                  :class="header.column.getCanSort() ? 'cursor-pointer select-none' : ''"
                  @click="header.column.getToggleSortingHandler()?.($event)"
                >
                  <FlexRender
                    v-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                  <svg
                    v-if="header.column.getIsSorted() === 'asc'"
                    class="h-4 w-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m18 15-6-6-6 6" />
                  </svg>
                  <svg
                    v-else-if="header.column.getIsSorted() === 'desc'"
                    class="h-4 w-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading" class="border-b border-border">
              <td
                :colspan="table.getAllColumns().length"
                class="p-8 text-center text-muted-foreground"
              >
                Loading...
              </td>
            </tr>
            <tr v-else-if="data.length === 0" class="border-b border-border">
              <td :colspan="table.getAllColumns().length" class="p-8">
                <LEmpty description="No data available" />
              </td>
            </tr>
            <tr
              v-for="row in rows"
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
    </template>

    <div
      v-if="showPagination"
      class="flex items-center justify-between p-4 border-t border-border"
    >
      <div class="text-sm text-muted-foreground">
        Total: {{ total }}
      </div>
      <LPagination
        :page="page"
        :page-size="pageSize"
        :item-count="total"
        :page-sizes="pageSizes"
        show-size-picker
        @update:page="handlePageUpdate"
        @update:page-size="handlePageSizeUpdate"
      />
    </div>
  </div>
</template>
