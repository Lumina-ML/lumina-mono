<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import LEmpty from "../primitives/LEmpty.vue";

export type TraceSpanStatus = "ok" | "success" | "error" | "warning" | "pending" | string;

export interface TraceSpan {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: TraceSpanStatus;
  children?: TraceSpan[];
}

export interface LTraceTimelineProps {
  spans: TraceSpan[];
  rootStartTime?: number;
  rootEndTime?: number;
  virtual?: boolean;
  containerHeight?: number;
  rowHeight?: number;
  defaultExpanded?: boolean;
  indentSize?: number;
}

const props = withDefaults(defineProps<LTraceTimelineProps>(), {
  virtual: false,
  containerHeight: 400,
  rowHeight: 32,
  defaultExpanded: true,
  indentSize: 16,
});

const emit = defineEmits<{
  select: [span: TraceSpan];
}>();

function spanEnd(span: TraceSpan): number {
  if (span.endTime !== undefined) return span.endTime;
  if (span.duration !== undefined) return span.startTime + span.duration;
  return span.startTime;
}

function collectIds(spans: TraceSpan[], ids: Set<string>): void {
  for (const span of spans) {
    ids.add(span.id);
    if (span.children?.length) collectIds(span.children, ids);
  }
}

const expanded = ref<Set<string>>(new Set());

function resetExpanded(): void {
  const next = new Set<string>();
  if (props.defaultExpanded) {
    collectIds(props.spans, next);
  }
  expanded.value = next;
}

watch(() => props.spans, resetExpanded, { immediate: true });
watch(() => props.defaultExpanded, resetExpanded);

function toggle(span: TraceSpan): void {
  const next = new Set(expanded.value);
  if (next.has(span.id)) {
    next.delete(span.id);
  } else {
    next.add(span.id);
  }
  expanded.value = next;
}

function isExpanded(span: TraceSpan): boolean {
  return expanded.value.has(span.id);
}

interface VisibleRow {
  span: TraceSpan;
  depth: number;
}

function flatten(rows: VisibleRow[], spans: TraceSpan[], depth: number): void {
  for (const span of spans) {
    rows.push({ span, depth });
    if (span.children?.length && isExpanded(span)) {
      flatten(rows, span.children, depth + 1);
    }
  }
}

const visibleRows = computed<VisibleRow[]>(() => {
  const rows: VisibleRow[] = [];
  flatten(rows, props.spans, 0);
  return rows;
});

const allSpans = computed<TraceSpan[]>(() => {
  const list: TraceSpan[] = [];
  function walk(spans: TraceSpan[]): void {
    for (const span of spans) {
      list.push(span);
      if (span.children?.length) walk(span.children);
    }
  }
  walk(props.spans);
  return list;
});

const computedRootStart = computed(() => {
  if (props.rootStartTime !== undefined) return props.rootStartTime;
  if (allSpans.value.length === 0) return 0;
  return Math.min(...allSpans.value.map((s) => s.startTime));
});

const computedRootEnd = computed(() => {
  if (props.rootEndTime !== undefined) return props.rootEndTime;
  if (allSpans.value.length === 0) return computedRootStart.value + 1;
  return Math.max(...allSpans.value.map((s) => spanEnd(s)));
});

const totalDuration = computed(() => {
  const duration = computedRootEnd.value - computedRootStart.value;
  return duration > 0 ? duration : 1;
});

function barStyle(span: TraceSpan): { left: string; width: string } {
  const start = span.startTime;
  const end = spanEnd(span);
  const left = ((start - computedRootStart.value) / totalDuration.value) * 100;
  const width = ((end - start) / totalDuration.value) * 100;
  return {
    left: `${Math.max(0, Math.min(100, left))}%`,
    width: `${Math.max(0, Math.min(100, width))}%`,
  };
}

const statusConfig: Record<string, { text: string; bg: string }> = {
  ok: { text: "text-success", bg: "bg-success" },
  success: { text: "text-success", bg: "bg-success" },
  error: { text: "text-error", bg: "bg-error" },
  warning: { text: "text-warning", bg: "bg-warning" },
  pending: { text: "text-muted-foreground", bg: "bg-muted-foreground" },
};

function statusConfigOf(status: TraceSpanStatus | undefined): { text: string; bg: string } {
  return statusConfig[status ?? ""] ?? { text: "text-foreground", bg: "bg-primary" };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatSpanDuration(span: TraceSpan): string {
  return formatDuration(spanEnd(span) - span.startTime);
}

function rowClasses(): string {
  return "flex items-center px-3 border-b border-border hover:bg-muted/50 cursor-pointer";
}

function getVisibleRow(index: number): VisibleRow {
  return visibleRows.value[index]!;
}

const parentRef = ref<HTMLElement | null>(null);

const virtualizer = useVirtualizer({
  get count() {
    return visibleRows.value.length;
  },
  getScrollElement: () => parentRef.value,
  estimateSize: () => props.rowHeight,
  overscan: 5,
});

watch(
  () => visibleRows.value.length,
  () => virtualizer.value.measure(),
);
</script>

<template>
  <div class="rounded-md border border-border bg-card text-sm">
    <div v-if="spans.length === 0" class="p-8">
      <LEmpty description="No trace spans available" />
    </div>

    <template v-else>
      <div class="flex items-center px-3 py-2 border-b border-border text-muted-foreground">
        <div class="flex-1">Span</div>
        <div class="flex-1 text-right">Timeline</div>
        <div class="w-20 text-right">Duration</div>
      </div>

      <div
        v-if="virtual"
        ref="parentRef"
        class="overflow-auto"
        :style="{ height: `${containerHeight}px` }"
      >
        <div
          :style="{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }"
        >
          <div
            v-for="virtualRow in virtualizer.getVirtualItems()"
            :key="String(virtualRow.key)"
            :class="rowClasses()"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }"
            @click="emit('select', getVisibleRow(virtualRow.index).span)"
          >
            <div
              class="flex-1 flex items-center min-w-0"
              :style="{ paddingLeft: `${getVisibleRow(virtualRow.index).depth * indentSize}px` }"
            >
              <button
                v-if="getVisibleRow(virtualRow.index).span.children?.length"
                type="button"
                class="mr-1 p-0.5 rounded hover:bg-muted text-muted-foreground"
                :aria-label="isExpanded(getVisibleRow(virtualRow.index).span) ? 'Collapse' : 'Expand'"
                @click.stop="toggle(getVisibleRow(virtualRow.index).span)"
              >
                <svg
                  :class="[
                    'w-4 h-4 transition-transform',
                    isExpanded(getVisibleRow(virtualRow.index).span) ? 'rotate-90' : '',
                  ]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <span v-else class="w-5 mr-1 shrink-0"></span>
              <span
                class="w-2 h-2 rounded-full shrink-0 mr-2"
                :class="statusConfigOf(getVisibleRow(virtualRow.index).span.status).bg"
              ></span>
              <span class="truncate text-foreground">
                {{ getVisibleRow(virtualRow.index).span.name }}
              </span>
            </div>
            <div class="flex-1 relative h-5 rounded bg-muted/50 mx-3">
              <div
                class="absolute top-0 h-full rounded opacity-60"
                :class="statusConfigOf(getVisibleRow(virtualRow.index).span.status).bg"
                :style="barStyle(getVisibleRow(virtualRow.index).span)"
              ></div>
            </div>
            <div class="w-20 text-right text-muted-foreground tabular-nums">
              {{ formatSpanDuration(getVisibleRow(virtualRow.index).span) }}
            </div>
          </div>
        </div>
      </div>

      <div v-else>
        <div
          v-for="row in visibleRows"
          :key="row.span.id"
          :class="rowClasses()"
          @click="emit('select', row.span)"
        >
          <div class="flex-1 flex items-center min-w-0" :style="{ paddingLeft: `${row.depth * indentSize}px` }">
            <button
              v-if="row.span.children?.length"
              type="button"
              class="mr-1 p-0.5 rounded hover:bg-muted text-muted-foreground"
              :aria-label="isExpanded(row.span) ? 'Collapse' : 'Expand'"
              @click.stop="toggle(row.span)"
            >
              <svg
                :class="['w-4 h-4 transition-transform', isExpanded(row.span) ? 'rotate-90' : '']"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <span v-else class="w-5 mr-1 shrink-0"></span>
            <span class="w-2 h-2 rounded-full shrink-0 mr-2" :class="statusConfigOf(row.span.status).bg"></span>
            <span class="truncate text-foreground">{{ row.span.name }}</span>
          </div>
          <div class="flex-1 relative h-5 rounded bg-muted/50 mx-3">
            <div
              class="absolute top-0 h-full rounded opacity-60"
              :class="statusConfigOf(row.span.status).bg"
              :style="barStyle(row.span)"
            ></div>
          </div>
          <div class="w-20 text-right text-muted-foreground tabular-nums">
            {{ formatSpanDuration(row.span) }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
