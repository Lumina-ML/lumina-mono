<script setup lang="ts">
interface Props {
  /** Optional accessible label when the inner text is symbolic (e.g. "⌘"). */
  ariaLabel?: string;
}
defineProps<Props>();
</script>

<template>
  <kbd
    :aria-label="ariaLabel"
    class="inline-flex items-center justify-center rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-xs text-fg-secondary"
  >
    <slot />
  </kbd>
</template>