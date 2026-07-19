<script setup lang="ts">
interface Props {
  ariaLabel?: string;
}

defineProps<Props>();
</script>

<template>
  <button
    type="button"
    :aria-label="ariaLabel"
    class="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <slot />
  </button>
</template>
