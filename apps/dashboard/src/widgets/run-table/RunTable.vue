<script setup lang="ts">
import { computed, h, ref } from "vue";
import { RouterLink } from "vue-router";
import { Archive, Download, Trash2, Filter as FilterIcon } from "lucide-vue-next";
import {
  LButton,
  LDataTable,
  LRadioGroup,
  LTag,
} from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import RunStatusBadge from "@/widgets/run-status-badge/RunStatusBadge.vue";
import { useDateFormat } from "@/composables/useDateFormat";
import { useTableDensity } from "@/composables/useTableDensity";
import { colorForRunId } from "@/composables/useRunColor";
import DataTableFilterBar, {
  type FilterChip,
} from "@/components/data-table/DataTableFilterBar.vue";
import DataTableBulkBar from "@/components/data-table/DataTableBulkBar.vue";
import DataTableColumnManager, {
  type ColumnToggle,
} from "@/components/data-table/DataTableColumnManager.vue";
import type { Run, RunStatus } from "@/types/run";

const props = defineProps<{
  runs: Run[];
  loading?: boolean;
  total?: number;
}>();

const emit = defineEmits<{
  bulk: [action: string, ids: string[]];
  compare: [ids: string[]];
}>();

const { formatDate, formatDurationMs } = useDateFormat();
const { density, set: setDensity } = useTableDensity();

const page = defineModel<number>("page", { default: 1 });
const pageSize = defineModel<number>("pageSize", { default: 20 });

// ── Filters ────────────────────────────────────────────────────────────
const quickSearch = ref("");
const filterChips = ref<FilterChip[]>([]);

const filterFields = [
  { key: "name", label: "Name", type: "text" as const },
  { key: "status", label: "Status", type: "text" as const },
  { key: "config.lr", label: "Config · lr", type: "number" as const },
  { key: "config.batch_size", label: "Config · batch_size", type: "number" as const },
  { key: "summary.accuracy", label: "Summary · accuracy", type: "number" as const },
  { key: "summary.loss", label: "Summary · loss", type: "number" as const },
];

// Apply filters client-side (server-side filtering is the next iteration;
// the backend already supports `status` so that one could move to the wire).
const filteredRuns = computed(() => {
  const chips = filterChips.value;
  const q = quickSearch.value.trim().toLowerCase();
  if (chips.length === 0 && !q) return props.runs;

  return props.runs.filter((run) => {
    // Every chip must match (AND semantics); quickSearch is a separate
    // contains-on-name check.
    for (const chip of chips) {
      const fieldVal = getNestedValue(run, chip.field);
      if (!matchesChip(fieldVal, chip)) return false;
    }
    if (q && !run.name.toLowerCase().includes(q)) return false;
    return true;
  });
});

/**
 * Resolve `a.b.c`-style field paths against a Run. Returns `undefined`
 * for missing segments so the chip matcher can treat absent values as
 * a non-match (chips want *equality*, not "field is empty").
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function matchesChip(value: unknown, chip: FilterChip): boolean {
  const target = chip.value;
  switch (chip.operator) {
    case "contains":
      return (
        value != null && String(value).toLowerCase().includes(target.toLowerCase())
      );
    case "equals":
      if (value == null) return target === "" || target === "null";
      // Try numeric equality first so "5" matches config.batch_size=5.
      const asNum = Number(target);
      if (!Number.isNaN(asNum) && typeof value === "number") {
        return value === asNum;
      }
      return String(value) === target;
    case ">":
      return Number(value) > Number(target);
    case ">=":
      return Number(value) >= Number(target);
    case "<":
      return Number(value) < Number(target);
    case "<=":
      return Number(value) <= Number(target);
    case "between": {
      const [lo, hi] = target.split(",").map((s) => Number(s.trim()));
      if (Number.isNaN(lo) || Number.isNaN(hi)) return false;
      const n = Number(value);
      return n >= lo && n <= hi;
    }
  }
}

const chipStatus = computed(() => {
  const statusChip = filterChips.value.find((c) => c.field === "status");
  return statusChip?.value ?? "";
});

// Reset to default filter state.
function resetFilters() {
  filterChips.value = [];
  quickSearch.value = "";
}

// ── Columns ────────────────────────────────────────────────────────────
const allColumns: ColumnToggle[] = [
  { key: "color", label: "Color" },
  { key: "status", label: "Status" },
  { key: "name", label: "Name" },
  { key: "createdAt", label: "Created" },
  { key: "duration", label: "Duration" },
  { key: "metrics", label: "Metrics" },
  { key: "sweep", label: "Sweep", group: "Tags" },
  { key: "actions", label: "" },
];

const visibleColumns = ref<string[]>(allColumns.map((c) => c.key));

function isColVisible(key: string): boolean {
  return visibleColumns.value.includes(key);
}

// ── Selection ──────────────────────────────────────────────────────────
const rowSelection = ref<Record<string, boolean>>({});
const selectedIds = computed(() => Object.keys(rowSelection.value).filter((k) => rowSelection.value[k]));
const selectedCount = computed(() => selectedIds.value.length);

// ── Build TanStack columns ─────────────────────────────────────────────
const columns = computed<ColumnDef<Run>[]>(() => {
  const cols: ColumnDef<Run>[] = [];
  if (isColVisible("color")) {
    cols.push({
      id: "color",
      header: "",
      size: 24,
      cell: ({ row }) =>
        h("span", {
          class: "inline-block h-2.5 w-2.5 rounded-sm",
          style: { backgroundColor: colorForRunId(row.original.runId) },
          "aria-hidden": "true",
        }),
    });
  }
  if (isColVisible("status")) {
    cols.push({
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => h(RunStatusBadge, { status: row.original.status }),
    });
  }
  if (isColVisible("name")) {
    cols.push({
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) =>
        h(
          RouterLink,
          {
            to: `/projects/${row.original.projectId}/runs/${row.original.runId}`,
            class: "font-medium hover:underline",
          },
          () => row.original.name,
        ),
    });
  }
  if (isColVisible("createdAt")) {
    cols.push({
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDate(row.original.createdAt),
    });
  }
  if (isColVisible("duration")) {
    cols.push({
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => {
        if (!row.original.finishedAt) return "—";
        const ms =
          new Date(row.original.finishedAt).getTime() -
          new Date(row.original.createdAt).getTime();
        return formatDurationMs(ms);
      },
    });
  }
  if (isColVisible("metrics")) {
    cols.push({
      accessorKey: "metrics",
      header: "Metrics",
      cell: ({ row }) => row.original._count?.metrics ?? 0,
    });
  }
  if (isColVisible("sweep")) {
    cols.push({
      accessorKey: "sweep",
      header: "Sweep",
      cell: ({ row }) =>
        row.original.sweepId
          ? h(
              RouterLink,
              {
                to: `/projects/${row.original.projectId}/sweeps/${row.original.sweepId}`,
                class: "font-mono text-xs hover:underline",
              },
              () => row.original.sweepId!.slice(0, 8),
            )
          : "—",
    });
  }
  if (isColVisible("actions")) {
    cols.push({
      id: "actions",
      header: "",
      cell: ({ row }) =>
        h(
          RouterLink,
          { to: `/projects/${row.original.projectId}/runs/${row.original.runId}` },
          () => h(LButton, { size: "sm" }, () => "View"),
        ),
    });
  }
  return cols;
});

const bulkActions = [
  { key: "archive", label: "Archive", icon: Archive },
  { key: "export", label: "Export", icon: Download },
  { key: "delete", label: "Delete", icon: Trash2, danger: true },
];

function onBulkAction(key: string) {
  emit("bulk", key, selectedIds.value);
}

function onCompare() {
  emit("compare", selectedIds.value);
}

function clearSelection() {
  rowSelection.value = {};
}

const statusFilter = computed<RunStatus | null>(() => {
  if (!chipStatus.value) return null;
  return chipStatus.value as RunStatus;
});

// Suppress unused-var warnings for things only consumed by template.
void statusFilter;
</script>

<template>
  <div class="space-y-3">
    <!-- Filter + bulk bar (mutually exclusive — bulk replaces filter when active) -->
    <DataTableBulkBar
      v-if="selectedCount > 0"
      :selected-count="selectedCount"
      :total-count="total ?? 0"
      :actions="bulkActions"
      @action="onBulkAction"
      @clear="clearSelection"
      @action-compare="onCompare"
    />
    <div v-else class="flex flex-wrap items-center justify-between gap-2">
      <DataTableFilterBar
        v-model:model-value="filterChips"
        v-model:quick-search="quickSearch"
        :fields="filterFields"
      />
      <div class="flex items-center gap-2">
        <DataTableColumnManager
          :columns="allColumns"
          v-model:visible="visibleColumns"
        />
        <LButton size="sm" quaternary @click="resetFilters">
          <FilterIcon class="mr-1 h-3 w-3" />
          Reset
        </LButton>
        <LRadioGroup
          :model-value="density"
          @update:model-value="(v: 'compact' | 'standard' | 'comfortable') => setDensity(v)"
          :options="[
            { label: 'Compact', value: 'compact' },
            { label: 'Standard', value: 'standard' },
            { label: 'Comfy', value: 'comfortable' },
          ]"
          size="small"
        />
      </div>
    </div>

    <!-- Quick stats strip -->
    <div v-if="selectedCount > 1" class="flex items-center gap-2 text-xs text-fg-tertiary">
      <LTag size="small" type="primary">{{ selectedCount }} runs selected</LTag>
      <span>·</span>
      <LButton size="xs" quaternary @click="onCompare">
          Compare →
        </LButton>
    </div>

    <LDataTable
      :data="filteredRuns"
      :columns="columns"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="total"
      enable-row-selection
      v-model:row-selection="rowSelection"
    />
  </div>
</template>