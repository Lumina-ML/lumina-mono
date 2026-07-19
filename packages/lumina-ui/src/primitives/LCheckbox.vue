<script setup lang="ts">
import { NCheckbox } from "naive-ui";

export interface LCheckboxProps {
  checked?: boolean;
  value?: boolean;
  label?: string;
  disabled?: boolean;
  indeterminate?: boolean;
}

const props = defineProps<LCheckboxProps>();

const emit = defineEmits<{
  "update:checked": [value: boolean];
  "update:value": [value: boolean];
}>();

function handleUpdate(value: boolean) {
  emit("update:checked", value);
  emit("update:value", value);
}
</script>

<template>
  <NCheckbox
    :checked="props.checked ?? props.value"
    :disabled="props.disabled"
    :indeterminate="props.indeterminate"
    @update:checked="handleUpdate"
  >
    {{ props.label }}
    <slot v-if="!props.label" />
  </NCheckbox>
</template>
