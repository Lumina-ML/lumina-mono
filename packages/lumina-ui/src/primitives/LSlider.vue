<script setup lang="ts">
import { NSlider } from "naive-ui";

export interface LSliderProps {
  value?: number | [number, number];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  range?: boolean;
  vertical?: boolean;
  tooltip?: boolean;
}

const props = withDefaults(defineProps<LSliderProps>(), {
  min: 0,
  max: 100,
  step: 1,
  tooltip: true,
});

defineEmits<{
  "update:value": [value: number | [number, number]];
}>();
</script>

<template>
  <NSlider
    :value="props.value"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :disabled="props.disabled"
    :range="props.range"
    :vertical="props.vertical"
    :tooltip="props.tooltip"
    @update:value="$emit('update:value', $event)"
  />
</template>
