<script setup lang="ts">
import { NSteps, NStep } from "naive-ui";

export interface LStep {
  title?: string;
  description?: string;
  status?: "wait" | "process" | "finish" | "error";
  disabled?: boolean;
}

export interface LStepsProps {
  current?: number;
  vertical?: boolean;
  size?: "small" | "medium";
  steps?: LStep[];
}

const props = withDefaults(defineProps<LStepsProps>(), {
  current: 0,
  vertical: false,
  size: "medium",
});

defineEmits<{
  "update:current": [value: number];
}>();
</script>

<template>
  <NSteps
    :current="props.current"
    :vertical="props.vertical"
    :size="props.size"
    @update:current="$emit('update:current', $event)"
  >
    <NStep
      v-for="(step, index) in props.steps"
      :key="index"
      :title="step.title"
      :description="step.description"
      :status="step.status"
      :disabled="step.disabled"
    />
  </NSteps>
</template>
