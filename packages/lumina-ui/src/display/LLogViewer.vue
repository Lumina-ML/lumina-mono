<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import LLogLine, { type LogLevel } from "../business/LLogLine.vue";
import LInput from "../primitives/LInput.vue";
import LSelect from "../primitives/LSelect.vue";
import LEmpty from "../primitives/LEmpty.vue";

export interface LogEntry {
  id?: string | number;
  timestamp?: Date | string | number;
  level?: LogLevel;
  message: string;
  step?: number;
}

interface Props {
  logs?: LogEntry[];
  loading?: boolean;
  height?: number;
  level?: LogLevel | null;
  search?: string;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  logs: () => [],
  loading: false,
  height: 400,
  level: null,
  search: "",
  placeholder: "Search logs...",
});

const emit = defineEmits<{
  "update:level": [value: LogLevel | null];
  "update:search": [value: string];
}>();

const levelFilter = ref<LogLevel | null>(props.level);
const searchText = ref<string>(props.search);

watch(
  () => props.level,
  (value) => {
    if (value !== levelFilter.value) {
      levelFilter.value = value ?? null;
    }
  },
);

watch(
  () => props.search,
  (value) => {
    if (value !== searchText.value) {
      searchText.value = value ?? "";
    }
  },
);

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

function onLevelChange(value: string | number | null) {
  const next = value ? String(value) : null;
  levelFilter.value = next;
  emit("update:level", next);
}

function onSearchChange(value: string | null) {
  const next = value ?? "";
  searchText.value = next;
  emit("update:search", next);
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-3">
      <LSelect
        :value="levelFilter"
        :options="levelOptions"
        placeholder="Filter by level"
        clearable
        style="width: 160px"
        @update:value="onLevelChange"
      />

      <div class="relative flex-1">
        <LInput
          :value="searchText"
          :placeholder="placeholder"
          clearable
          @update:value="onSearchChange"
        >
          <template #prefix>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </template>
        </LInput>
      </div>

      <span class="text-sm text-muted-foreground">{{ filteredLogs.length }} lines</span>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center text-muted-foreground"
      :style="{ height: `${height}px` }"
    >
      Loading logs...
    </div>
    <div
      v-else-if="filteredLogs.length === 0"
      class="flex items-center justify-center"
      :style="{ height: `${height}px` }"
    >
      <LEmpty description="No logs available" />
    </div>
    <div
      v-else
      ref="parentRef"
      class="overflow-auto rounded-md border border-border bg-card"
      :style="{ height: `${height}px` }"
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
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }"
          class="border-b border-border px-3 py-1 hover:bg-muted/50"
        >
          <LLogLine
            :timestamp="filteredLogs[virtualRow.index].timestamp"
            :level="filteredLogs[virtualRow.index].level"
            :message="filteredLogs[virtualRow.index].message"
            :step="filteredLogs[virtualRow.index].step"
          />
        </div>
      </div>
    </div>
  </div>
</template>
