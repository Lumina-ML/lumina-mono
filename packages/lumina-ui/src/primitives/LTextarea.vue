<script setup lang="ts">
import { NInput } from "naive-ui";

export interface LTextareaProps {
  value?: string | null;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  clearable?: boolean;
  size?: "small" | "medium" | "large";
  status?: "success" | "warning" | "error";
  rows?: number;
  maxlength?: number;
  showCount?: boolean;
  resize?: "none" | "both" | "horizontal" | "vertical";
}

const props = defineProps<LTextareaProps>();

const emit = defineEmits<{
  "update:value": [value: string | null];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();
</script>

<template>
  <NInput
    type="textarea"
    :value="props.value"
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :clearable="props.clearable"
    :size="props.size"
    :status="props.status"
    :rows="props.rows ?? 4"
    :maxlength="props.maxlength"
    :show-count="props.showCount"
    :resizable="props.resize !== 'none'"
    :style="props.resize ? { resize: props.resize } : undefined"
    @update:value="$emit('update:value', $event)"
    @blur="$emit('blur', $event)"
    @focus="$emit('focus', $event)"
  >
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name" />
    </template>
  </NInput>
</template>
