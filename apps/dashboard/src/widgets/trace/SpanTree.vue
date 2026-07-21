<script setup lang="ts">
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import { LButton } from "@lumina/ui";
import type { SpanNode } from "./types";

defineProps<{
  spans: SpanNode[];
  selectedSpanId: string | null;
}>();

const emit = defineEmits<{
  select: [spanId: string];
}>();

function statusClass(span: SpanNode): string {
  const status = (span.attributes.status as string | undefined) ?? "ok";
  if (status === "error" || status === "failed") return "bg-accent-danger";
  if (status === "warning") return "bg-accent-warning";
  if (status === "pending") return "bg-fg-tertiary";
  return "bg-accent-success";
}

function durationMs(span: SpanNode): number {
  if (!span.endTime) return 0;
  return Math.max(
    0,
    new Date(span.endTime).getTime() - new Date(span.startTime).getTime(),
  );
}
</script>

<template>
  <div class="overflow-y-auto text-xs">
    <div v-if="spans.length === 0" class="p-4 text-fg-tertiary">
      No spans recorded.
    </div>
    <ul class="space-y-0.5 p-2">
      <li v-for="span in spans" :key="span.id">
        <div class="flex flex-col">
          <LButton
            quaternary
            size="xs"
            :class="[
              '!group !flex w-full !items-center !gap-1.5 !rounded-md !px-2 !py-1 !text-left',
              selectedSpanId === span.id
                ? '!bg-accent-primary/15 !font-medium !text-fg-primary'
                : 'hover:!bg-canvas !text-fg-secondary',
            ]"
            @click="emit('select', span.id)"
          >
            <ChevronRight v-if="span.children.length > 0" class="h-3 w-3 flex-shrink-0 text-fg-tertiary" />
            <ChevronDown v-else class="h-3 w-3 flex-shrink-0 text-fg-tertiary" />
            <span :class="['h-2 w-2 flex-shrink-0 rounded-sm', statusClass(span)]" />
            <span class="min-w-0 flex-1 truncate font-mono text-[11px]">
              {{ span.name }}
            </span>
            <span class="shrink-0 font-mono text-[10px] text-fg-tertiary">
              {{ durationMs(span) }}ms
            </span>
          </LButton>
          <ul
            v-if="span.children.length > 0"
            class="ml-3 space-y-0.5 border-l border-border pl-1"
          >
            <li v-for="child in span.children" :key="child.id">
              <div class="flex flex-col">
                <LButton
                  quaternary
                  size="xs"
                  :class="[
                    '!group !flex w-full !items-center !gap-1.5 !rounded-md !px-2 !py-1 !text-left',
                    selectedSpanId === child.id
                      ? '!bg-accent-primary/15 !font-medium !text-fg-primary'
                      : 'hover:!bg-canvas !text-fg-secondary',
                  ]"
                  @click="emit('select', child.id)"
                >
                  <ChevronRight v-if="child.children.length > 0" class="h-3 w-3 flex-shrink-0 text-fg-tertiary" />
                  <ChevronDown v-else class="h-3 w-3 flex-shrink-0 text-fg-tertiary" />
                  <span :class="['h-2 w-2 flex-shrink-0 rounded-sm', statusClass(child)]" />
                  <span class="min-w-0 flex-1 truncate font-mono text-[11px]">
                    {{ child.name }}
                  </span>
                  <span class="shrink-0 font-mono text-[10px] text-fg-tertiary">
                    {{ durationMs(child) }}ms
                  </span>
                </LButton>
                <ul
                  v-if="child.children.length > 0"
                  class="ml-3 space-y-0.5 border-l border-border pl-1"
                >
                  <li v-for="grand in child.children" :key="grand.id">
                    <LButton
                      quaternary
                      size="xs"
                      :class="[
                        '!flex w-full !items-center !gap-1.5 !rounded-md !px-2 !py-1 !text-left',
                        selectedSpanId === grand.id
                          ? '!bg-accent-primary/15 !font-medium !text-fg-primary'
                          : 'hover:!bg-canvas !text-fg-secondary',
                      ]"
                      @click="emit('select', grand.id)"
                    >
                      <ChevronRight v-if="grand.children.length > 0" class="h-3 w-3 flex-shrink-0 text-fg-tertiary" />
                      <ChevronDown v-else class="h-3 w-3 flex-shrink-0 text-fg-tertiary" />
                      <span :class="['h-2 w-2 flex-shrink-0 rounded-sm', statusClass(grand)]" />
                      <span class="min-w-0 flex-1 truncate font-mono text-[11px]">
                        {{ grand.name }}
                      </span>
                      <span class="shrink-0 font-mono text-[10px] text-fg-tertiary">
                        {{ durationMs(grand) }}ms
                      </span>
                    </LButton>
                  </li>
                </ul>
              </div>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </div>
</template>