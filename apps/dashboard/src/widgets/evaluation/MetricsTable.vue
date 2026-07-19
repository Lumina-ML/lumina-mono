<script setup lang="ts">
import { computed, h } from "vue";
import { LCard, LDataTable } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";

interface PerClassMetric {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

const props = defineProps<{
  rows: PerClassMetric[];
}>();

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

const macroAvg = computed(() => {
  if (props.rows.length === 0)
    return { precision: 0, recall: 0, f1: 0, support: 0 };
  const n = props.rows.length;
  const supportTotal = props.rows.reduce((a, r) => a + r.support, 0);
  const w = (k: "precision" | "recall" | "f1") =>
    supportTotal === 0
      ? props.rows.reduce((a, r) => a + r[k], 0) / n
      : props.rows.reduce((a, r) => a + r[k] * r.support, 0) / supportTotal;
  return {
    precision: w("precision"),
    recall: w("recall"),
    f1: w("f1"),
    support: supportTotal,
  };
});

const columns: ColumnDef<PerClassMetric>[] = [
  {
    accessorKey: "label",
    header: "Class",
    cell: ({ row }) =>
      h("span", { class: "font-mono" }, row.original.label),
  },
  {
    accessorKey: "precision",
    header: "Precision",
    cell: ({ row }) => pct(row.original.precision),
  },
  {
    accessorKey: "recall",
    header: "Recall",
    cell: ({ row }) => pct(row.original.recall),
  },
  {
    accessorKey: "f1",
    header: "F1",
    cell: ({ row }) => pct(row.original.f1),
  },
  {
    accessorKey: "support",
    header: "Support",
    cell: ({ row }) =>
      h("span", { class: "font-mono" }, String(row.original.support)),
  },
];
</script>

<template>
  <LCard class="p-0">
    <div class="border-b border-border px-4 py-3">
      <h3 class="text-xs font-medium uppercase tracking-wider text-fg-tertiary">
        Per-class metrics
      </h3>
    </div>
    <LDataTable
      :data="rows"
      :columns="columns"
      :page-size="50"
    />
    <div class="grid grid-cols-4 gap-2 border-t border-border bg-canvas px-4 py-2 text-xs">
      <div>
        <div class="text-[10px] font-medium uppercase text-fg-tertiary">Macro Precision</div>
        <div class="font-mono">{{ pct(macroAvg.precision) }}</div>
      </div>
      <div>
        <div class="text-[10px] font-medium uppercase text-fg-tertiary">Macro Recall</div>
        <div class="font-mono">{{ pct(macroAvg.recall) }}</div>
      </div>
      <div>
        <div class="text-[10px] font-medium uppercase text-fg-tertiary">Macro F1</div>
        <div class="font-mono">{{ pct(macroAvg.f1) }}</div>
      </div>
      <div>
        <div class="text-[10px] font-medium uppercase text-fg-tertiary">Total Support</div>
        <div class="font-mono">{{ macroAvg.support }}</div>
      </div>
    </div>
  </LCard>
</template>