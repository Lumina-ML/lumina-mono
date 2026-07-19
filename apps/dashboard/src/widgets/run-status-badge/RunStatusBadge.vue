<script setup lang="ts">
import { LStatusBadge } from "@lumina/ui";
import type { RunStatus } from "@/types/run";

defineProps<{
  status: RunStatus;
}>();
</script>

<template>
  <LStatusBadge :status="status" />
</template>
