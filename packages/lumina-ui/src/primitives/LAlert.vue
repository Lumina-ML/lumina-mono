<script setup lang="ts">
import { NAlert } from "naive-ui";

export interface LAlertProps {
  title?: string;
  type?: "default" | "info" | "success" | "warning" | "error";
  closable?: boolean;
  showIcon?: boolean;
}

withDefaults(defineProps<LAlertProps>(), {
  type: "default",
  showIcon: true,
});

defineEmits<{
  close: [];
}>();
</script>

<template>
  <NAlert
    :title="title"
    :type="type"
    :closable="closable"
    :show-icon="showIcon"
    @close="$emit('close')"
  >
    <slot />
  </NAlert>
</template>
