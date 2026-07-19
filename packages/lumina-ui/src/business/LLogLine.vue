<script setup lang="ts">
import { computed } from "vue";
import LTimestamp from "./LTimestamp.vue";

export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL" | string;

export interface LLogLineProps {
  timestamp?: Date | string | number;
  level?: LogLevel;
  message: string;
  step?: number;
}

const props = defineProps<LLogLineProps>();

const levelClasses: Record<string, string> = {
  DEBUG: "text-muted-foreground",
  INFO: "text-foreground",
  WARNING: "text-warning",
  WARN: "text-warning",
  ERROR: "text-error",
  CRITICAL: "text-error font-semibold",
};

const levelClass = computed(() => levelClasses[props.level ?? "INFO"] ?? "text-foreground");
</script>

<template>
  <div class="flex gap-3 font-mono text-xs leading-5">
    <span v-if="timestamp" class="shrink-0 text-muted-foreground">
      <LTimestamp :value="timestamp" preset="time" />
    </span>
    <span v-if="step !== undefined" class="shrink-0 text-muted-foreground">
      step {{ step }}
    </span>
    <span :class="['shrink-0 font-semibold uppercase', levelClass]">
      {{ level ?? "INFO" }}
    </span>
    <span class="break-all text-foreground">{{ message }}</span>
  </div>
</template>
