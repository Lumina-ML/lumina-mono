<script setup lang="ts">
import { NResult } from "naive-ui";

interface Props {
  status?: "404" | "403" | "500" | "418" | "info" | "success" | "warning" | "error";
  title?: string;
  description?: string;
}

defineProps<Props>();
</script>

<template>
  <NResult v-bind="$props">
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name" />
    </template>
  </NResult>
</template>
