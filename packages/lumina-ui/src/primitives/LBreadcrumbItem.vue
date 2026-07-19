<script setup lang="ts">
import { RouterLink } from "vue-router";

interface Props {
  to?: string;
}

defineProps<Props>();
</script>

<template>
  <li class="flex items-center gap-1.5">
    <component
      :is="to ? RouterLink : 'span'"
      :to="to"
      :class="[
        'transition-colors',
        to ? 'hover:text-foreground' : 'text-foreground',
      ]"
    >
      <slot />
    </component>
    <span class="text-muted-foreground/50" aria-hidden="true">/</span>
  </li>
</template>
