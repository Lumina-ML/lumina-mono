<script setup lang="ts">
import { NTag } from "naive-ui";
import type { RunStatus } from "@/types/run";

const props = defineProps<{
  status: RunStatus;
}>();

const statusMap: Record<RunStatus, { type: "default" | "success" | "warning" | "error"; text: string }> = {
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
  <NTag :type="config.type" size="small" round>{{ config.text }}</NTag>
</template>
