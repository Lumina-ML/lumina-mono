<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import {
  ArrowDown,
  Copy,
  Check,
  Lock,
  Search,
} from "lucide-vue-next";
import { LSelect, LEmpty, LTag, LIconButton, LTooltip, LInput, LButton } from "@lumina/ui";
import { redactLogMessage } from "@/composables/useLogRedaction";
import { useDateFormat } from "@/composables/useDateFormat";
import type { LogLine, LogLevel } from "@/types/log-line";

const props = defineProps<{
  logs: LogLine[];
  loading?: boolean;
  height?: number;
  /** When true (default), auto-scroll to the latest line. */
  autoScroll?: boolean;
  /** When true, scrub secret-looking values from each log line. */
  redactSecrets?: boolean;
}>();

const emit = defineEmits<{
  "update:level": [value: LogLevel | null];
}>();

const levelFilter = defineModel<LogLevel | null>("level", { default: null });
const searchText = defineModel<string>("search", { default: "" });

const { formatDate } = useDateFormat();

const levelOptions = [
  { label: "All", value: "" },
  { label: "DEBUG", value: "DEBUG" },
  { label: "INFO", value: "INFO" },
  { label: "WARNING", value: "WARNING" },
  { label: "ERROR", value: "ERROR" },
  { label: "CRITICAL", value: "CRITICAL" },
];

const normalizedSearch = computed(() => searchText.value.trim().toLowerCase());

const filteredLogs = computed(() => {
  let result = props.logs;
  if (levelFilter.value) {
    result = result.filter((log) => log.level === levelFilter.value);
  }
  if (normalizedSearch.value) {
    result = result.filter((log) =>
      log.message.toLowerCase().includes(normalizedSearch.value),
    );
  }
  return result;
});

const redactedLogs = computed(() => {
  if (!props.redactSecrets) return filteredLogs.value;
  return filteredLogs.value.map((l) => ({
    ...l,
    message: redactLogMessage(l.message),
  }));
});

const parentRef = ref<HTMLElement | null>(null);

const virtualizer = useVirtualizer({
  get count() {
    return redactedLogs.value.length;
  },
  getScrollElement: () => parentRef.value,
  estimateSize: () => 24,
  overscan: 10,
});

watch(
  () => filteredLogs.value.length,
  () => virtualizer.value.measure(),
);

// ── Auto-scroll + jump-to-bottom ────────────────────────────────────────
const isAtBottom = ref(true);
const stickToBottom = ref(props.autoScroll !== false);

function onScroll() {
  if (!parentRef.value) return;
  const { scrollTop, scrollHeight, clientHeight } = parentRef.value;
  isAtBottom.value = scrollHeight - scrollTop - clientHeight < 40;
  stickToBottom.value = isAtBottom.value;
}

function scrollToBottom() {
  stickToBottom.value = true;
  void nextTick(() => {
    if (parentRef.value) {
      parentRef.value.scrollTop = parentRef.value.scrollHeight;
    }
  });
}

watch(
  () => redactedLogs.value.length,
  () => {
    if (stickToBottom.value) {
      void nextTick(() => {
        if (parentRef.value) {
          parentRef.value.scrollTop = parentRef.value.scrollHeight;
        }
      });
    }
  },
);

onMounted(() => {
  parentRef.value?.addEventListener("scroll", onScroll, { passive: true });
});

onUnmounted(() => {
  parentRef.value?.removeEventListener("scroll", onScroll);
});

// ── Permalink + copy ────────────────────────────────────────────────────
const copiedLine = ref<number | null>(null);

function lineAnchor(index: number): string {
  return `#L${index + 1}`;
}

async function copyLine(index: number) {
  const log = redactedLogs.value[index];
  if (!log) return;
  const url = `${window.location.origin}${window.location.pathname}${window.location.hash.split("?")[0]}${lineAnchor(index)}`;
  await navigator.clipboard.writeText(
    `${log.timestamp ?? ""} ${log.level ?? ""} ${log.message}\n${url}`,
  );
  copiedLine.value = index;
  setTimeout(() => {
    if (copiedLine.value === index) copiedLine.value = null;
  }, 1500);
}

const showJumpToBottom = computed(
  () => redactedLogs.value.length > 50 && !isAtBottom.value,
);
</script>

<template>
  <div class="relative space-y-3">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3">
      <LSelect
        :value="levelFilter"
        :options="levelOptions"
        placeholder="Filter by level"
        clearable
        style="width: 160px"
        @update:value="(v) => emit('update:level', v ? String(v) as LogLevel : null)"
      />
      <div class="relative min-w-[180px] flex-1">
        <LInput
          v-model:value="searchText"
          placeholder="Search logs…"
          clearable
        >
          <template #prefix>
            <Search class="h-4 w-4 text-fg-tertiary" />
          </template>
        </LInput>
      </div>
      <span class="font-mono text-xs text-fg-tertiary">
        {{ redactedLogs.length }} lines
      </span>
      <LTooltip v-if="redactSecrets" content="Secret redaction enabled">
        <LTag size="small" type="info">
          <Lock class="mr-1 inline h-3 w-3" />
          Redact on
        </LTag>
      </LTooltip>
    </div>

    <!-- Log body -->
    <div
      v-if="loading"
      class="flex items-center justify-center text-fg-tertiary"
      :style="{ height: `${height ?? 400}px` }"
    >
      Loading logs…
    </div>
    <div
      v-else-if="redactedLogs.length === 0"
      class="flex items-center justify-center"
      :style="{ height: `${height ?? 400}px` }"
    >
      <LEmpty description="No logs available" />
    </div>
    <div
      v-else
      ref="parentRef"
      class="overflow-auto rounded-md border border-border bg-canvas font-mono text-xs"
      :style="{ height: `${height ?? 400}px` }"
    >
      <div
        :style="{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }"
      >
        <div
          v-for="virtualRow in virtualizer.getVirtualItems()"
          :key="String(virtualRow.key)"
          :id="`L${virtualRow.index + 1}`"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }"
          class="group flex items-start gap-2 border-b border-border/50 px-2 py-0.5 hover:bg-card"
        >
          <span class="w-12 flex-shrink-0 select-none text-right text-fg-tertiary">
            {{ virtualRow.index + 1 }}
          </span>
          <LButton
            quaternary
            size="xs"
            class="!w-44 !flex-shrink-0 !cursor-pointer !truncate !text-left !text-fg-tertiary hover:!text-fg-primary !justify-start !p-0"
            :title="`Permalink to line ${virtualRow.index + 1}`"
            @click="copyLine(virtualRow.index)"
          >
            <component
              :is="copiedLine === virtualRow.index ? Check : Copy"
              class="mr-1 inline h-3 w-3"
              :class="copiedLine === virtualRow.index ? 'text-accent-success' : 'opacity-0 group-hover:opacity-100'"
            />
            {{ formatDate(redactedLogs[virtualRow.index].timestamp) }}
          </LButton>
          <span
            v-if="redactedLogs[virtualRow.index].level"
            :class="[
              'w-16 flex-shrink-0 uppercase',
              redactedLogs[virtualRow.index].level === 'ERROR' ? 'text-accent-danger' :
              redactedLogs[virtualRow.index].level === 'WARNING' ? 'text-accent-warning' :
              redactedLogs[virtualRow.index].level === 'CRITICAL' ? 'text-accent-danger font-semibold' :
              redactedLogs[virtualRow.index].level === 'DEBUG' ? 'text-fg-tertiary' :
              'text-fg-secondary',
            ]"
          >
            {{ redactedLogs[virtualRow.index].level }}
          </span>
          <span class="min-w-0 flex-1 whitespace-pre-wrap break-words text-fg-primary">
            {{ redactedLogs[virtualRow.index].message }}
          </span>
        </div>
      </div>
    </div>

    <!-- Jump to bottom floating button -->
    <Transition name="jump-fade">
      <LIconButton
        v-if="showJumpToBottom"
        aria-label="Jump to latest"
        class="absolute bottom-6 left-1/2 -translate-x-1/2 shadow-lg"
        @click="scrollToBottom"
      >
        <ArrowDown class="h-4 w-4" />
      </LIconButton>
    </Transition>
  </div>
</template>

<style scoped>
.jump-fade-enter-active,
.jump-fade-leave-active {
  transition: opacity 200ms ease;
}
.jump-fade-enter-from,
.jump-fade-leave-to {
  opacity: 0;
}
</style>