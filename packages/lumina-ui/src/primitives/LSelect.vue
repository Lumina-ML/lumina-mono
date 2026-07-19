<script setup lang="ts">
import { NSelect } from "naive-ui";

interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
  [key: string]: unknown;
}

interface Props {
  value?: string | number | null;
  options?: SelectOption[];
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
  style?: string | Record<string, string>;
}

defineProps<Props>();

defineEmits<{
  "update:value": [value: string | number | null];
}>();
</script>

<template>
  <NSelect
    :value="value"
    :options="(options as any)"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :size="size"
    :style="style"
    @update:value="$emit('update:value', $event)"
  />
</template>
