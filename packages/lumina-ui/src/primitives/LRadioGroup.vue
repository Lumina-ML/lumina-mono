<script setup lang="ts">
import { NRadioGroup, NRadio } from "naive-ui";

export interface LRadioGroupOption {
  label: string;
  value: string | number | boolean;
  disabled?: boolean;
}

export interface LRadioGroupProps {
  value?: string | number | boolean | null;
  options?: LRadioGroupOption[];
  disabled?: boolean;
  name?: string;
  size?: "small" | "medium" | "large";
}

const props = defineProps<LRadioGroupProps>();

const emit = defineEmits<{
  "update:value": [value: string | number | boolean | null];
}>();
</script>

<template>
  <NRadioGroup
    :value="props.value"
    :disabled="props.disabled"
    :name="props.name"
    :size="props.size"
    @update:value="$emit('update:value', $event)"
  >
    <template v-if="props.options">
      <NRadio
        v-for="option in props.options"
        :key="String(option.value)"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </NRadio>
    </template>
    <slot v-else />
  </NRadioGroup>
</template>
