<script setup lang="ts">
import { NSwitch } from "naive-ui";

export interface LSwitchProps {
  value?: boolean;
  checked?: boolean;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
  round?: boolean;
  loading?: boolean;
}

const props = defineProps<LSwitchProps>();

const emit = defineEmits<{
  "update:value": [value: boolean];
  "update:checked": [value: boolean];
}>();

function handleUpdate(value: boolean) {
  emit("update:value", value);
  emit("update:checked", value);
}
</script>

<template>
  <NSwitch
    :value="props.checked ?? props.value"
    :disabled="props.disabled"
    :size="props.size"
    :round="props.round ?? true"
    :loading="props.loading"
    @update:value="handleUpdate"
  >
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name" />
    </template>
  </NSwitch>
</template>
