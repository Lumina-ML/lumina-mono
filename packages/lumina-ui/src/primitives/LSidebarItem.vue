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
      'group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-fast',
      active
        ? 'bg-muted font-medium text-foreground'
        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    ]"
  >
    <span
      :class="[
        'absolute left-0 h-5 w-[2px] rounded-r-full bg-primary transition-opacity duration-fast',
        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-0',
      ]"
      aria-hidden="true"
    />
    <span class="flex h-5 w-5 shrink-0 items-center justify-center">
      <slot name="icon" />
    </span>
    <span class="truncate">
      <slot />
    </span>
  </component>
</template>
