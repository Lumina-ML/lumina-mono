<script setup lang="ts">
import { useDateFormat } from "../composables/useDateFormat";

export interface LTimestampProps {
  value?: Date | string | number;
  preset?: "datetime" | "date" | "time" | "short" | "long" | "relative" | "iso";
}

const props = withDefaults(defineProps<LTimestampProps>(), {
  preset: "datetime",
});

const formatted = useDateFormat(() => props.value, { preset: props.preset });
</script>

<template>
  <span class="tabular-nums text-muted-foreground">{{ formatted }}</span>
</template>
