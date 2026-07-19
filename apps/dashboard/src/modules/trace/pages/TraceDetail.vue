<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  LSkeleton,
  LCard,
  LTag,
  LTraceTimeline,
  LEmpty,
  LJsonView,
} from "@lumina/ui";
import type { TraceSpan } from "@lumina/ui";
import { ArrowLeft, Clock, Hash, Activity, ChevronRight } from "lucide-vue-next";
import { useTrace } from "@/modules/trace/composables/useTraces";
import { TraceService } from "@/services/trace.service";
import { useDateFormat } from "@/composables/useDateFormat";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const traceId = computed(() => route.params.traceId as string);
const { formatDate, formatDurationMs } = useDateFormat();

const { data: trace, isLoading } = useTrace(traceId);

const { data: spans, isLoading: spansLoading } = useQuery({
  queryKey: computed(() => ["trace-spans", traceId.value]),
  queryFn: () => TraceService.listSpans(traceId.value),
  enabled: computed(() => !!traceId.value),
});

interface SpanNode {
  id: string;
  parentSpanId: string | null;
  name: string;
  startTime: string;
  endTime: string | null;
  attributes: Record<string, unknown>;
  children: SpanNode[];
}

function buildSpanTree(
  flat: Array<{
    id: string;
    parentSpanId: string | null;
    name: string;
    startTime: string;
    endTime: string | null;
    attributes: Record<string, unknown>;
  }>,
): SpanNode[] {
  const byId = new Map<string, SpanNode>();
  for (const s of flat) byId.set(s.id, { ...s, children: [] });
  const roots: SpanNode[] = [];
  for (const node of byId.values()) {
    if (node.parentSpanId && byId.has(node.parentSpanId)) {
      byId.get(node.parentSpanId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

const spanTree = computed<SpanNode[]>(() => buildSpanTree(spans.value ?? []));

const traceSpans = computed<TraceSpan[]>(() => {
  function toTraceSpan(node: SpanNode): TraceSpan {
    const startMs = new Date(node.startTime).getTime();
    const endMs = node.endTime ? new Date(node.endTime).getTime() : Date.now();
    return {
      id: node.id,
      name: node.name,
      startTime: startMs,
      endTime: endMs,
      duration: endMs - startMs,
      status: (node.attributes as { status?: string }).status ?? "ok",
      children: node.children.map(toTraceSpan),
    };
  }
  return spanTree.value.map(toTraceSpan);
});

const durationMs = computed(() => {
  if (!trace.value?.startTime) return 0;
  const start = new Date(trace.value.startTime).getTime();
  const end = trace.value.endTime ? new Date(trace.value.endTime).getTime() : Date.now();
  return end - start;
});

const flatSpanList = computed<SpanNode[]>(() => {
  const out: SpanNode[] = [];
  function walk(nodes: SpanNode[]) {
    for (const n of nodes) {
      out.push(n);
      walk(n.children);
    }
  }
  walk(spanTree.value);
  return out;
});
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      :to="`/projects/${projectId}`"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to project
    </RouterLink>

    <LSkeleton v-if="isLoading" text :repeat="3" />

    <template v-else-if="trace">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h1 class="truncate text-2xl font-semibold tracking-tight">
            {{ trace.name }}
          </h1>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-fg-tertiary">
            <LTag size="small" type="info">{{ trace.status }}</LTag>
            <span class="flex items-center gap-1">
              <Clock class="h-3.5 w-3.5" />
              {{ formatDurationMs(durationMs) }}
            </span>
            <span class="flex items-center gap-1 font-mono">
              <Hash class="h-3.5 w-3.5" />
              {{ trace.id.slice(0, 12) }}
            </span>
            <span>Started {{ formatDate(trace.startTime) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <LTag size="small" type="default">
            {{ trace._count?.spans ?? flatSpanList.length }} spans
          </LTag>
        </div>
      </div>

      <LCard class="p-4">
        <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
          Span Timeline
        </h3>
        <div v-if="spansLoading" class="py-12 text-center text-sm text-fg-tertiary">
          Loading spans…
        </div>
        <LTraceTimeline
          v-else-if="traceSpans.length > 0"
          :spans="traceSpans"
          :container-height="500"
        />
        <LEmpty
          v-else
          title="No spans recorded"
          description="This trace has no spans yet."
          class="py-8"
        />
      </LCard>

      <div class="grid gap-4 lg:grid-cols-2">
        <LCard class="p-4">
          <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
            Spans
          </h3>
          <ul v-if="flatSpanList.length > 0" class="divide-y divide-border">
            <li
              v-for="span in flatSpanList"
              :key="span.id"
              class="flex items-center gap-2 py-2 text-sm"
            >
              <ChevronRight class="h-3.5 w-3.5 text-fg-tertiary" />
              <Activity class="h-3.5 w-3.5 text-fg-tertiary" />
              <span class="truncate">{{ span.name }}</span>
              <span class="ml-auto font-mono text-xs text-fg-tertiary">
                {{ span.endTime ? formatDurationMs(new Date(span.endTime).getTime() - new Date(span.startTime).getTime()) : "—" }}
              </span>
            </li>
          </ul>
          <p v-else class="py-4 text-center text-sm text-fg-tertiary">
            No spans.
          </p>
        </LCard>

        <LCard class="p-4">
          <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
            Metadata
          </h3>
          <LJsonView
            v-if="trace.metadata && Object.keys(trace.metadata).length > 0"
            :data="trace.metadata"
            :deep="3"
          />
          <p v-else class="py-4 text-center text-sm text-fg-tertiary">
            No metadata.
          </p>
        </LCard>
      </div>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Trace not found.
    </LCard>
  </div>
</template>