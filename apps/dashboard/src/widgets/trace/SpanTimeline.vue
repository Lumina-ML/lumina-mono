<script setup lang="ts">
import { computed } from "vue";
import { LButton } from "@lumina/ui";
import type { SpanNode } from "./types";
import { timeBounds } from "./types";

const props = defineProps<{
  spans: SpanNode[];
  selectedSpanId: string | null;
}>();

const emit = defineEmits<{
  select: [spanId: string];
}>();

const bounds = computed(() => timeBounds(props.spans));
const totalSpan = computed(() => {
  const b = bounds.value;
  if (!b) return 1;
  return Math.max(1, b.end - b.start);
});

function pct(value: number): string {
  return `${(value / totalSpan.value) * 100}%`;
}

function spanOffset(span: SpanNode): string {
  const b = bounds.value;
  if (!b) return "0%";
  const start = new Date(span.startTime).getTime();
  return pct(Math.max(0, start - b.start));
}

function spanWidth(span: SpanNode): string {
  const start = new Date(span.startTime).getTime();
  const end = span.endTime ? new Date(span.endTime).getTime() : start;
  return pct(Math.max(1, end - start));
}

function statusClass(span: SpanNode): string {
  const status = (span.attributes.status as string | undefined) ?? "ok";
  if (status === "error" || status === "failed") return "bg-accent-danger/70";
  if (status === "warning") return "bg-accent-warning/70";
  if (status === "pending") return "bg-fg-tertiary/50";
  return "bg-accent-primary/70";
}

function flattenForTimeline(spans: SpanNode[], depth = 0, out: Array<{ span: SpanNode; depth: number }> = []) {
  for (const s of spans) {
    out.push({ span: s, depth });
    flattenForTimeline(s.children, depth + 1, out);
  }
  return out;
}

const rows = computed(() => flattenForTimeline(props.spans));
</script>

<template>
  <div class="overflow-y-auto">
    <div v-if="rows.length === 0" class="p-6 text-center text-xs text-fg-tertiary">
      No spans to render.
    </div>
    <div v-else class="relative">
      <!-- Header row: time axis -->
      <div class="sticky top-0 z-10 flex border-b border-border bg-card">
        <div class="w-44 flex-shrink-0 border-r border-border px-2 py-1 text-[10px] font-medium uppercase text-fg-tertiary">
          Span
        </div>
        <div class="relative h-6 flex-1">
          <div class="absolute inset-y-0 left-0 flex w-full items-center justify-between px-2 font-mono text-[10px] text-fg-tertiary">
            <span>0ms</span>
            <span>{{ Math.round(totalSpan / 2) }}ms</span>
            <span>{{ Math.round(totalSpan) }}ms</span>
          </div>
        </div>
      </div>

      <!-- Bars -->
      <div>
        <LButton
          v-for="row in rows"
          :key="row.span.id"
          quaternary
          size="xs"
          :class="[
            '!flex w-full !items-center !border-b !border-border !text-left !rounded-none !p-0',
            selectedSpanId === row.span.id ? '!bg-accent-primary/5' : 'hover:!bg-canvas',
          ]"
          @click="emit('select', row.span.id)"
        >
          <div
            class="w-44 flex-shrink-0 truncate border-r border-border px-2 py-1 font-mono text-[11px]"
            :style="{ paddingLeft: `${row.depth * 8 + 8}px` }"
          >
            {{ row.span.name }}
          </div>
          <div class="relative h-6 flex-1">
            <div
              :class="[
                'absolute top-1/2 h-3 -translate-y-1/2 cursor-pointer rounded-sm transition-all hover:h-4',
                statusClass(row.span),
                selectedSpanId === row.span.id ? 'ring-1 ring-accent-primary' : '',
              ]"
              :style="{
                left: spanOffset(row.span),
                width: spanWidth(row.span),
              }"
              :title="`${row.span.name}: ${spanWidth(row.span)}`"
            />
          </div>
        </LButton>
      </div>
    </div>
  </div>
</template>