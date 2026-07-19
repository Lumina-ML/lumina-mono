<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  LSkeleton,
  LCard,
  LTag,
  LEmpty,
  LSwitch,
} from "@lumina/ui";
import {
  ArrowLeft,
  Clock,
  Hash,
  MessageSquare,
} from "lucide-vue-next";
import { useTrace } from "@/modules/trace/composables/useTraces";
import { TraceService } from "@/services/trace.service";
import { useDateFormat } from "@/composables/useDateFormat";
import {
  buildSpanTree,
  findSpan,
  type SpanNode,
} from "@/widgets/trace/types";
import SpanTree from "@/widgets/trace/SpanTree.vue";
import SpanTimeline from "@/widgets/trace/SpanTimeline.vue";
import SpanDetail from "@/widgets/trace/SpanDetail.vue";

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

const spanTree = computed<SpanNode[]>(() => buildSpanTree(spans.value ?? []));

const selectedSpanId = ref<string | null>(null);
const chatMode = ref(false);

const selectedSpan = computed<SpanNode | null>(() => {
  if (!selectedSpanId.value) return null;
  return findSpan(spanTree.value, selectedSpanId.value);
});

// Auto-select the first root span when data arrives.
watch(spanTree, (tree) => {
  if (!selectedSpanId.value && tree.length > 0) {
    selectedSpanId.value = tree[0]!.id;
  }
});

const durationMs = computed(() => {
  if (!trace.value?.startTime) return 0;
  const start = new Date(trace.value.startTime).getTime();
  const end = trace.value.endTime
    ? new Date(trace.value.endTime).getTime()
    : Date.now();
  return end - start;
});

const spanCount = computed(() => {
  const walk = (nodes: SpanNode[]): number =>
    nodes.reduce((a, n) => a + 1 + walk(n.children), 0);
  return walk(spanTree.value);
});

import { watch } from "vue";
</script>

<template>
  <div class="space-y-4">
    <RouterLink
      :to="`/projects/${projectId}`"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to project
    </RouterLink>

    <LSkeleton v-if="isLoading" text :repeat="3" />

    <template v-else-if="trace">
      <div class="flex flex-wrap items-start justify-between gap-3">
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
        <div class="flex items-center gap-3">
          <label class="flex cursor-pointer items-center gap-2 text-xs">
            <LSwitch v-model:value="chatMode" />
            <MessageSquare class="h-3.5 w-3.5" />
            Chat mode
          </label>
          <LTag size="small" type="default">
            {{ spanCount }} spans
          </LTag>
        </div>
      </div>

      <!-- Three-column layout -->
      <div
        class="grid gap-3 overflow-hidden"
        style="grid-template-columns: 280px minmax(0, 1fr) 360px; height: calc(100vh - 220px); min-height: 480px;"
      >
        <!-- Tree -->
        <LCard class="overflow-hidden p-0">
          <div class="border-b border-border px-3 py-2">
            <h3 class="text-xs font-medium uppercase tracking-wider text-fg-tertiary">
              Spans
            </h3>
          </div>
          <LSkeleton v-if="spansLoading" class="p-3" :repeat="4" />
          <SpanTree
            v-else-if="spanTree.length > 0"
            :spans="spanTree"
            :selected-span-id="selectedSpanId"
            @select="(id: string) => (selectedSpanId = id)"
          />
          <LEmpty
            v-else
            class="p-6"
            title="No spans"
            description="This trace has no spans yet."
          />
        </LCard>

        <!-- Timeline -->
        <LCard class="overflow-hidden p-0">
          <div class="border-b border-border px-3 py-2">
            <h3 class="text-xs font-medium uppercase tracking-wider text-fg-tertiary">
              Timeline
            </h3>
          </div>
          <LSkeleton v-if="spansLoading" class="p-3" :repeat="4" />
          <SpanTimeline
            v-else-if="spanTree.length > 0"
            :spans="spanTree"
            :selected-span-id="selectedSpanId"
            @select="(id: string) => (selectedSpanId = id)"
          />
          <LEmpty
            v-else
            class="p-6"
            title="No spans"
            description="This trace has no spans yet."
          />
        </LCard>

        <!-- Detail -->
        <LCard class="overflow-hidden p-0">
          <div class="border-b border-border px-3 py-2">
            <h3 class="text-xs font-medium uppercase tracking-wider text-fg-tertiary">
              Detail
            </h3>
          </div>
          <SpanDetail :span="selectedSpan" :chat-mode="chatMode" />
        </LCard>
      </div>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Trace not found.
    </LCard>
  </div>
</template>