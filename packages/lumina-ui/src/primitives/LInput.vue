<script setup lang="ts">
import { NInput } from "naive-ui";
import type { InputProps } from "naive-ui";

export interface LInputProps {
  value?: string | null;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  clearable?: boolean;
  size?: "small" | "medium" | "large";
  type?: InputProps["type"];
  status?: InputProps["status"];
  maxlength?: number;
  rows?: number;
}

const props = defineProps<LInputProps>();

const emit = defineEmits<{
  "update:value": [value: string | null];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();
</script>

<template>
  <NInput
    :value="props.value"
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :clearable="props.clearable"
    :size="props.size"
    :type="props.type"
    :status="props.status"
    :maxlength="props.maxlength"
    :rows="props.rows"
    @update:value="$emit('update:value', $event)"
    @blur="$emit('blur', $event)"
    @focus="$emit('focus', $event)"
  >
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name" />
    </template>
  </NInput>
</template>
