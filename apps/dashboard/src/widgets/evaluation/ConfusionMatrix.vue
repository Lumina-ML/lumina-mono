<script setup lang="ts">
import { computed } from "vue";
import { LCard, LTooltip } from "@lumina/ui";
import type { ConfusionMatrix } from "./types";

const props = defineProps<{
  matrix: ConfusionMatrix;
  /** Optional normalized view (each row sums to 1). */
  normalized?: boolean;
}>();

const max = computed(() => {
  let m = 0;
  for (const row of props.matrix.matrix) {
    for (const v of row) if (v > m) m = v;
  }
  return m || 1;
});

const rowTotals = computed(() =>
  props.matrix.matrix.map((row) => row.reduce((a, b) => a + b, 0)),
);

function cellOpacity(value: number): number {
  return Math.max(0.05, value / max.value);
}

function displayValue(value: number, rowIndex: number): string {
  if (props.normalized) {
    const total = rowTotals.value[rowIndex] ?? 0;
    if (total === 0) return "—";
    return `${((value / total) * 100).toFixed(1)}%`;
  }
  return String(value);
}

function colorFor(value: number, rowIndex: number, colIndex: number): string {
  if (rowIndex === colIndex) {
    // Diagonal — green tone, intensity = value.
    return `rgba(16, 185, 129, ${cellOpacity(value)})`;
  }
  // Off-diagonal — red tone.
  return `rgba(239, 68, 68, ${cellOpacity(value)})`;
}

function textColor(value: number): string {
  return cellOpacity(value) > 0.5 ? "text-white" : "text-fg-primary";
}
</script>

<template>
  <LCard class="p-4">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-xs font-medium uppercase tracking-wider text-fg-tertiary">
        Confusion Matrix
        <span class="ml-2 normal-case text-fg-tertiary">
          (rows = actual, columns = predicted)
        </span>
      </h3>
      <div class="flex items-center gap-2 text-[10px]">
        <span class="flex items-center gap-1">
          <span class="h-2 w-2 rounded-sm bg-accent-success" />
          Correct
        </span>
        <span class="flex items-center gap-1">
          <span class="h-2 w-2 rounded-sm bg-accent-danger" />
          Miss
        </span>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th class="w-20" />
            <th
              v-for="label in matrix.labels"
              :key="`col-${label}`"
              class="px-2 py-1 text-center font-mono text-[10px] font-medium text-fg-tertiary"
            >
              {{ label }}
            </th>
            <th class="px-2 py-1 text-center text-[10px] font-medium text-fg-tertiary">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in matrix.matrix" :key="`row-${i}`">
            <th class="px-2 py-1 text-right font-mono text-[10px] font-medium text-fg-tertiary">
              {{ matrix.labels[i] }}
            </th>
            <td
              v-for="(value, j) in row"
              :key="`cell-${i}-${j}`"
              class="min-w-[60px] rounded-sm p-0"
            >
              <LTooltip
                :content="`${matrix.labels[i]} → ${matrix.labels[j]}: ${value}`"
              >
                <div
                  :class="[
                    'flex h-9 items-center justify-center rounded-sm font-mono text-xs',
                    textColor(value),
                  ]"
                  :style="{ backgroundColor: colorFor(value, i, j) }"
                >
                  {{ displayValue(value, i) }}
                </div>
              </LTooltip>
            </td>
            <td class="px-2 py-1 text-center font-mono text-[10px] text-fg-secondary">
              {{ rowTotals[i] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </LCard>
</template>