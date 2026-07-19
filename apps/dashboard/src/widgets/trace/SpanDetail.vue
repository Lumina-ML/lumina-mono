<script setup lang="ts">
import { computed } from "vue";
import { LCard, LJsonView, LTag, LEmpty } from "@lumina/ui";
import { Bot, User as UserIcon, MessageSquare } from "lucide-vue-next";
import { useDateFormat } from "@/composables/useDateFormat";
import type { SpanNode } from "./types";

const props = defineProps<{
  span: SpanNode | null;
  /** When true, render chat-style bubbles for LLM spans. */
  chatMode?: boolean;
}>();

const { formatDate, formatDurationMs } = useDateFormat();

const isLlmSpan = computed(() => {
  if (!props.span) return false;
  const name = props.span.name.toLowerCase();
  return (
    name.includes("llm") ||
    name.includes("chat") ||
    name.includes("gpt") ||
    name.includes("claude") ||
    name.includes("agent")
  );
});

const inputAttr = computed(() => {
  const attrs = props.span?.attributes ?? {};
  return (
    attrs.input ??
    attrs.prompt ??
    attrs.messages ??
    attrs.user_input ??
    null
  );
});

const outputAttr = computed(() => {
  const attrs = props.span?.attributes ?? {};
  return (
    attrs.output ??
    attrs.completion ??
    attrs.response ??
    attrs.messages ??
    null
  );
});

const durationMs = computed(() => {
  if (!props.span?.endTime) return 0;
  return (
    new Date(props.span.endTime).getTime() -
    new Date(props.span.startTime).getTime()
  );
});

const statusVariant = (() => {
  const s = (props.span?.attributes.status as string | undefined) ?? "ok";
  if (s === "error" || s === "failed") return "error" as const;
  if (s === "warning") return "warning" as const;
  return "success" as const;
})();
</script>

<template>
  <div class="overflow-y-auto">
    <div v-if="!span" class="flex h-full items-center justify-center p-8 text-center text-xs text-fg-tertiary">
      <LEmpty
        title="Pick a span"
        description="Select a span from the tree or timeline to inspect its attributes."
        :icon="MessageSquare"
      />
    </div>

    <div v-else class="space-y-3 p-3">
      <!-- Header -->
      <div>
        <h3 class="truncate font-mono text-sm font-medium">{{ span.name }}</h3>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <LTag size="small" :type="statusVariant">
            {{ span.attributes.status ?? "ok" }}
          </LTag>
          <span class="font-mono text-[10px] text-fg-tertiary">
            {{ formatDate(span.startTime) }}
          </span>
          <span class="font-mono text-[10px] text-fg-tertiary">
            {{ formatDurationMs(durationMs) }}
          </span>
        </div>
        <div class="mt-1 font-mono text-[10px] text-fg-tertiary">
          {{ span.id }}
        </div>
      </div>

      <!-- Chat-style for LLM spans -->
      <div v-if="chatMode && isLlmSpan && (inputAttr || outputAttr)" class="space-y-3">
        <LCard v-if="inputAttr" class="p-3">
          <div class="mb-2 flex items-center gap-2 text-xs font-medium">
            <UserIcon class="h-3.5 w-3.5" />
            <span>Input</span>
          </div>
          <pre class="overflow-x-auto whitespace-pre-wrap rounded-md bg-canvas p-2 font-mono text-xs">{{ formatChat(inputAttr) }}</pre>
        </LCard>

        <LCard v-if="outputAttr" class="p-3">
          <div class="mb-2 flex items-center gap-2 text-xs font-medium">
            <Bot class="h-3.5 w-3.5" />
            <span>Output</span>
          </div>
          <pre class="overflow-x-auto whitespace-pre-wrap rounded-md bg-canvas p-2 font-mono text-xs">{{ formatChat(outputAttr) }}</pre>
        </LCard>
      </div>

      <!-- Raw attributes -->
      <LCard class="p-3">
        <h4 class="mb-2 text-xs font-medium">Attributes</h4>
        <LJsonView
          v-if="Object.keys(span.attributes).length > 0"
          :data="span.attributes"
          :deep="4"
        />
        <p v-else class="text-xs text-fg-tertiary">No attributes recorded.</p>
      </LCard>

      <!-- Children summary -->
      <LCard v-if="span.children.length > 0" class="p-3">
        <h4 class="mb-2 text-xs font-medium">
          Children ({{ span.children.length }})
        </h4>
        <ul class="space-y-1 text-xs">
          <li
            v-for="c in span.children"
            :key="c.id"
            class="font-mono"
          >
            {{ c.name }}
            <span class="text-fg-tertiary"> · {{ c.attributes.status ?? "ok" }}</span>
          </li>
        </ul>
      </LCard>
    </div>
  </div>
</template>

<script lang="ts">
// Helper kept as a top-level function so the template can call it.
export function formatChat(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
</script>