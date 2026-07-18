<script setup lang="ts">
import LTag from "./LTag.vue";

type StatusVariant = "default" | "success" | "warning" | "error";

const props = defineProps<{
  status: string;
}>();

const statusMap: Record<string, { type: StatusVariant; text: string }> = {
  pending: { type: "default", text: "Pending" },
  running: { type: "warning", text: "Running" },
  finished: { type: "success", text: "Finished" },
  failed: { type: "error", text: "Failed" },
  crashed: { type: "error", text: "Crashed" },
  killed: { type: "error", text: "Killed" },
};

const config = statusMap[props.status] ?? { type: "default", text: props.status };
</script>

<template>
  <LTag :type="config.type" size="small" round>{{ config.text }}</LTag>
</template>
