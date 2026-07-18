<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { NSelect, NEmpty } from "naive-ui";
import type { LogLine, LogLevel } from "@/types/log-line";

const props = defineProps<{
  logs: LogLine[];
  loading?: boolean;
}>();

const levelFilter = defineModel<LogLevel | null>("level", { default: null });

const levelOptions = [
  { label: "All", value: "" },
  { label: "DEBUG", value: "DEBUG" },
  { label: "INFO", value: "INFO" },
  { label: "WARNING", value: "WARNING" },
  { label: "ERROR", value: "ERROR" },
  { label: "CRITICAL", value: "CRITICAL" },
];

const filteredLogs = computed(() => {
  if (!levelFilter.value) return props.logs;
  return props.logs.filter((log) => log.level === levelFilter.value);
});

const parentRef = ref<HTMLElement | null>(null);

const virtualizer = useVirtualizer({
  get count() {
    return filteredLogs.value.length;
  },
  getScrollElement: () => parentRef.value,
  estimateSize: () => 28,
  overscan: 10,
});

watch(
  () => filteredLogs.value.length,
  () => virtualizer.value.measure(),
);

const levelColor: Record<LogLevel, string> = {
  DEBUG: "text-muted-foreground",
  INFO: "text-blue-600 dark:text-blue-400",
  WARNING: "text-yellow-600 dark:text-yellow-400",
  ERROR: "text-red-600 dark:text-red-400",
  CRITICAL: "text-red-700 dark:text-red-300 font-bold",
};
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <NSelect
        v-model:value="levelFilter"
        :options="levelOptions"
        placeholder="Filter by level"
        clearable
        style="width: 160px"
      />
      <span class="text-sm text-muted-foreground">{{ filteredLogs.length }} lines</span>
    </div>

    <div
      v-if="loading"
      class="h-[400px] flex items-center justify-center text-muted-foreground"
    >
      Loading logs...
    </div>
    <div v-else-if="filteredLogs.length === 0" class="h-[400px] flex items-center justify-center">
      <NEmpty description="No logs available" />
    </div>
    <div
      v-else
      ref="parentRef"
      class="h-[400px] overflow-auto rounded-md border border-border bg-card font-mono text-sm"
    >
      <div :style="{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }">
        <div
          v-for="virtualRow in virtualizer.getVirtualItems()"
          :key="String(virtualRow.key)"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }"
          class="px-3 py-1 border-b border-border hover:bg-muted/50 flex gap-3"
        >
          <span class="text-muted-foreground w-24 shrink-0">
            {{ new Date(filteredLogs[virtualRow.index].timestamp).toLocaleTimeString() }}
          </span>
          <span :class="levelColor[filteredLogs[virtualRow.index].level]" class="w-20 shrink-0">
            {{ filteredLogs[virtualRow.index].level }}
          </span>
          <span class="break-all">{{ filteredLogs[virtualRow.index].message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
