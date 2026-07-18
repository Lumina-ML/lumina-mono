<script setup lang="ts">
import { RouterLink } from "vue-router";

interface Props {
  to?: string;
  active?: boolean;
}

defineProps<Props>();
</script>

<template>
  <component
    :is="to ? RouterLink : 'button'"
    :to="to"
    :class="[
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
      active
        ? 'bg-muted font-medium text-foreground'
        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    ]"
  >
    <span class="flex h-5 w-5 shrink-0 items-center justify-center">
      <slot name="icon" />
    </span>
    <span class="truncate">
      <slot />
    </span>
  </component>
</template>
