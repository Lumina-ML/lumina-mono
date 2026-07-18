<script setup lang="ts">
interface Props {
  label?: string;
  value?: string | number;
}

defineProps<Props>();
</script>

<template>
  <div class="space-y-1">
    <div class="text-sm text-muted-foreground">{{ label }}</div>
    <div class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
      <slot name="prefix" />
      <span>{{ value }}</span>
    </div>
  </div>
</template>
