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
    class="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-all duration-fast hover:bg-muted hover:text-foreground active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <slot />
  </button>
</template>
