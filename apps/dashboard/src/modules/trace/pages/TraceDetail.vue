<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  LSkeleton,
  LCard,
  LTag,
  LEmpty,
  LSwitch,
  LButton,
  LDialog,
  LInput,
  LSelect,
} from "@lumina/ui";
import {
  ArrowLeft,
  Clock,
  Hash,
  MessageSquare,
  Plus,
  StopCircle,
} from "lucide-vue-next";
import { useTrace } from "@/modules/trace/composables/useTraces";
import { TraceService } from "@/services/trace.service";
import { useDateFormat } from "@/composables/useDateFormat";
import { useToast } from "@/composables/useToast";
import {
  buildSpanTree,
  findSpan,
  type SpanNode,
} from "@/widgets/trace/types";
import type { SpanKind, CreateSpanInput } from "@/types/trace";
import SpanTree from "@/widgets/trace/SpanTree.vue";
import SpanTimeline from "@/widgets/trace/SpanTimeline.vue";
import SpanDetail from "@/widgets/trace/SpanDetail.vue";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const traceId = computed(() => route.params.traceId as string);
const { formatDate, formatDurationMs } = useDateFormat();
const queryClient = useQueryClient();
const toast = useToast();

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

// ── Manual span creation (Roadmap §M3-3) ────────────────────────────
const spanDialogOpen = ref(false);
const spanName = ref("");
const spanKind = ref<SpanKind>("internal");
const spanParentId = ref<string | null>(null);
const spanLatencyText = ref("");
const spanError = ref<string | null>(null);

const spanKindOptions: Array<{ value: SpanKind; label: string }> = [
  { value: "llm", label: "LLM" },
  { value: "tool", label: "Tool" },
  { value: "retriever", label: "Retriever" },
  { value: "chain", label: "Chain" },
  { value: "agent", label: "Agent" },
  { value: "internal", label: "Internal" },
];

const spanParentOptions = computed(() => {
  const flat: Array<{ value: string; label: string }> = [
    { value: "", label: "(root span)" },
  ];
  const walk = (nodes: SpanNode[], depth: number) => {
    for (const n of nodes) {
      flat.push({
        value: n.id,
        label: `${"  ".repeat(depth)}${n.name}`,
      });
      walk(n.children, depth + 1);
    }
  };
  walk(spanTree.value, 0);
  return flat;
});

function openSpanDialog() {
  spanName.value = "";
  spanKind.value = "internal";
  spanParentId.value = selectedSpanId.value ?? null;
  spanLatencyText.value = "";
  spanError.value = null;
  spanDialogOpen.value = true;
}

const createSpanMutation = useMutation({
  mutationFn: () => {
    const input: CreateSpanInput = {
      name: spanName.value.trim(),
      kind: spanKind.value,
      ...(spanParentId.value ? { parentSpanId: spanParentId.value } : {}),
      ...(spanLatencyText.value.trim()
        ? { latencyMs: Number(spanLatencyText.value) }
        : {}),
    };
    if (input.latencyMs !== undefined && Number.isNaN(input.latencyMs)) {
      throw new Error("Latency must be a number (milliseconds).");
    }
    return TraceService.createSpan(traceId.value, input);
  },
  onSuccess: (span) => {
    toast.success(`Span "${span.name}" created.`);
    spanDialogOpen.value = false;
    queryClient.invalidateQueries({ queryKey: ["trace-spans", traceId.value] });
    selectedSpanId.value = span.id;
  },
  onError: (e) => {
    spanError.value = (e as Error).message ?? "Unknown error";
  },
});

// ── Finish trace ──────────────────────────────────────────────────────
const traceFinished = computed(
  () => !!trace.value?.endTime || trace.value?.status === "ok" || trace.value?.status === "error",
);
const finishMutation = useMutation({
  mutationFn: () =>
    TraceService.patchTrace(traceId.value, {
      status: "ok",
      finishedAt: new Date().toISOString(),
    }),
  onSuccess: () => {
    toast.success("Trace marked as finished.");
    queryClient.invalidateQueries({ queryKey: ["trace", traceId.value] });
  },
});
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
          <LButton size="sm" @click="openSpanDialog">
            <Plus class="mr-1 h-3 w-3" />
            New span
          </LButton>
          <LButton
            v-if="!traceFinished"
            size="sm"
            quaternary
            :loading="finishMutation.isPending.value"
            @click="finishMutation.mutate()"
          >
            <StopCircle class="mr-1 h-3 w-3" />
            Finish trace
          </LButton>
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

    <!-- New-span dialog (Roadmap §M3-3). -->
    <LDialog
      v-model:show="spanDialogOpen"
      title="New span"
      width="480px"
      @close="spanError = null"
    >
      <form class="space-y-3" @submit.prevent="createSpanMutation.mutate()">
        <div>
          <label for="span-name" class="mb-1 block text-xs font-medium text-fg-secondary">
            Name <span class="text-accent-danger">*</span>
          </label>
          <LInput
            id="span-name"
            v-model:value="spanName"
            placeholder="e.g. retrieve-context"
            autofocus
          />
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label for="span-kind" class="mb-1 block text-xs font-medium text-fg-secondary">
              Kind
            </label>
            <LSelect
              id="span-kind"
              v-model:value="spanKind"
              :options="spanKindOptions"
            />
          </div>
          <div>
            <label for="span-latency" class="mb-1 block text-xs font-medium text-fg-secondary">
              Latency (ms, optional)
            </label>
            <LInput
              id="span-latency"
              v-model:value="spanLatencyText"
              placeholder="e.g. 250"
            />
          </div>
        </div>
        <div>
          <label for="span-parent" class="mb-1 block text-xs font-medium text-fg-secondary">
            Parent span
          </label>
          <LSelect
            id="span-parent"
            v-model:value="spanParentId"
            :options="spanParentOptions"
            placeholder="(root span)"
          />
        </div>
        <div
          v-if="spanError"
          class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
        >
          {{ spanError }}
        </div>
      </form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton quaternary @click="spanDialogOpen = false">Cancel</LButton>
          <LButton
            :loading="createSpanMutation.isPending.value"
            :disabled="!spanName.trim()"
            @click="createSpanMutation.mutate()"
          >
            Create span
          </LButton>
        </div>
      </template>
    </LDialog>
  </div>
</template>