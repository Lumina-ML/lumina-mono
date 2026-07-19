<script setup lang="ts">
import { NMenu } from "naive-ui";
import type { MenuOption } from "naive-ui";

export interface LMenuProps {
  options?: MenuOption[];
  value?: string | null;
  mode?: "vertical" | "horizontal";
  collapsed?: boolean;
  collapsedWidth?: number;
  indent?: number;
  disabled?: boolean;
}

const props = withDefaults(defineProps<LMenuProps>(), {
  mode: "vertical",
  collapsedWidth: 64,
  indent: 24,
});

const emit = defineEmits<{
  "update:value": [value: string];
}>();
</script>

<template>
  <NMenu
    :options="(props.options as any)"
    :value="props.value ?? undefined"
    :mode="props.mode"
    :collapsed="props.collapsed"
    :collapsed-width="props.collapsedWidth"
    :indent="props.indent"
    :disabled="props.disabled"
    @update:value="$emit('update:value', $event)"
  />
</template>
