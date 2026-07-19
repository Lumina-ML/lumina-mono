<script setup lang="ts">
import { NDropdown } from "naive-ui";
import type { DropdownOption } from "naive-ui";

export interface LDropdownProps {
  options?: DropdownOption[];
  placement?:
    | "top"
    | "top-start"
    | "top-end"
    | "bottom"
    | "bottom-start"
    | "bottom-end"
    | "left"
    | "left-start"
    | "left-end"
    | "right"
    | "right-start"
    | "right-end";
  trigger?: "hover" | "click" | "focus" | "manual";
  disabled?: boolean;
  show?: boolean;
}

const props = withDefaults(defineProps<LDropdownProps>(), {
  placement: "bottom-start",
  trigger: "click",
});

const emit = defineEmits<{
  "update:show": [value: boolean];
  select: [key: string | number];
}>();
</script>

<template>
  <NDropdown
    :options="(props.options as any)"
    :placement="props.placement"
    :trigger="props.trigger"
    :disabled="props.disabled"
    :show="props.show"
    @update:show="$emit('update:show', $event)"
    @select="$emit('select', $event)"
  >
    <slot />
  </NDropdown>
</template>
