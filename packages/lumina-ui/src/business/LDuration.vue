<script setup lang="ts">
import { computed } from "vue";

export interface LDurationProps {
  /** 持续时间（毫秒） */
  durationMs?: number;
  /** 开始时间 */
  startedAt?: Date | string | number;
  /** 结束时间，默认当前时间 */
  endedAt?: Date | string | number;
  /** 空值占位 */
  placeholder?: string;
}

const props = withDefaults(defineProps<LDurationProps>(), {
  placeholder: "—",
});

function toMs(value: Date | string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

const duration = computed(() => {
  if (props.durationMs !== undefined) return props.durationMs;
  const start = toMs(props.startedAt);
  if (start === undefined) return undefined;
  const end = toMs(props.endedAt) ?? Date.now();
  return Math.max(0, end - start);
});

const formatted = computed(() => {
  if (duration.value === undefined) return props.placeholder;

  const totalSeconds = Math.floor(duration.value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
});
</script>

<template>
  <span class="tabular-nums">{{ formatted }}</span>
</template>
