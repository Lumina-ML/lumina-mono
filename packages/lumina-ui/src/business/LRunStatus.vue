<script setup lang="ts">
import LTag from "../primitives/LTag.vue";

export type RunStatus =
  | "pending"
  | "running"
  | "finished"
  | "failed"
  | "crashed"
  | "killed"
  | "preempting"
  | "preempted"
  | string;

export interface LRunStatusProps {
  status: RunStatus;
}

const props = defineProps<LRunStatusProps>();

type Variant = "default" | "success" | "warning" | "error" | "info";

const statusMap: Record<string, { variant: Variant; text: string }> = {
  pending: { variant: "default", text: "Pending" },
  running: { variant: "warning", text: "Running" },
  finished: { variant: "success", text: "Finished" },
  failed: { variant: "error", text: "Failed" },
  crashed: { variant: "error", text: "Crashed" },
  killed: { variant: "error", text: "Killed" },
  preempting: { variant: "info", text: "Preempting" },
  preempted: { variant: "info", text: "Preempted" },
};

const config = statusMap[props.status] ?? { variant: "default", text: props.status };
</script>

<template>
  <LTag :type="config.variant" size="small" round>
    {{ config.text }}
  </LTag>
</template>
