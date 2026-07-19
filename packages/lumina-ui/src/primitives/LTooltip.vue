<script setup lang="ts">
import { NTooltip } from "naive-ui";

export interface LTooltipProps {
  content?: string;
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
  delay?: number;
}

const props = withDefaults(defineProps<LTooltipProps>(), {
  placement: "top",
  trigger: "hover",
});
</script>

<template>
  <NTooltip
    :placement="props.placement"
    :trigger="props.trigger"
    :disabled="props.disabled"
    :delay="props.delay"
  >
    <template #trigger>
      <slot />
    </template>
    {{ props.content }}
    <slot name="content" />
  </NTooltip>
</template>
