<script setup lang="ts">
import { NRadio } from "naive-ui";

export interface LRadioProps {
  value: string | number | boolean;
  label?: string;
  disabled?: boolean;
}

const props = defineProps<LRadioProps>();
</script>

<template>
  <NRadio :value="props.value" :disabled="props.disabled">
    {{ props.label }}
    <slot v-if="!props.label" />
  </NRadio>
</template>
