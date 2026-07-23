<script setup lang="ts">
import { computed } from "vue";

interface Props {
  /** Icon height in px. Width auto-scales to preserve aspect. */
  size?: number;
  /** Show the wordmark next to the icon. */
  showWordmark?: boolean;
  /** Tonal treatment — `mark` keeps the brand color, `mono` forces currentColor. */
  variant?: "mark" | "mono";
}

const props = withDefaults(defineProps<Props>(), {
  size: 28,
  showWordmark: false,
  variant: "mark",
});

const iconStyle = computed(() => ({
  height: `${props.size}px`,
  width: "auto",
  filter: props.variant === "mono" ? "grayscale(1) brightness(0) invert(1)" : "none",
}));

const textSizeClass = computed(() => {
  if (props.size >= 32) return "text-xl";
  if (props.size >= 24) return "text-lg";
  return "text-base";
});
</script>

<template>
  <span class="inline-flex items-center gap-2 leading-none">
    <!-- Brand logo image — kept as a raw <img> because it's a static
         asset, not an avatar/photo, so LAvatar's src+alt contract
         doesn't fit. Allowed exception to the dashboard atom-only rule. -->
    <!-- eslint-disable-next-line vue/no-restricted-html-elements -->
    <img
      src="/Lumina-Ml.png"
      alt="Lumina"
      class="brand-mark"
      :style="iconStyle"
      draggable="false"
    />
    <span
      v-if="showWordmark"
      :class="['font-semibold tracking-tight', textSizeClass]"
    >
      Lumina
    </span>
  </span>
</template>

<style scoped>
.brand-mark {
  display: block;
  user-select: none;
  /* Lift the icon off the dark sidebar background by treating it as a
     non-replaced inline image — avoid layout shift while it loads. */
  aspect-ratio: 1 / 1;
  object-fit: contain;
}
</style>
