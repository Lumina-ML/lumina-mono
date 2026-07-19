<script setup lang="ts">
import { NPopover } from "naive-ui";

export interface LPopoverProps {
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
  width?: number;
}

const props = withDefaults(defineProps<LPopoverProps>(), {
  placement: "bottom-start",
  trigger: "click",
});

defineEmits<{
  "update:show": [value: boolean];
}>();
</script>

<template>
  <NPopover
    :placement="props.placement"
    :trigger="props.trigger"
    :disabled="props.disabled"
    :show="props.show"
    :width="props.width"
    @update:show="$emit('update:show', $event)"
  >
    <template #trigger>
      <slot />
    </template>
    <slot name="content" />
  </NPopover>
</template>
