<script setup lang="ts">
import { computed } from "vue";

export interface LAvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "square";
}

const props = withDefaults(defineProps<LAvatarProps>(), {
  size: "md",
  shape: "circle",
});

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

const fallbackText = computed(() => {
  if (props.fallback) return props.fallback;
  if (props.alt) return props.alt.slice(0, 2).toUpperCase();
  return "";
});

const hasImage = computed(() => Boolean(props.src));
</script>

<template>
  <div
    :class="[
      'inline-flex items-center justify-center overflow-hidden bg-muted font-medium text-muted-foreground',
      sizeClasses[props.size],
      props.shape === 'circle' ? 'rounded-full' : 'rounded-md',
    ]"
  >
    <img
      v-if="hasImage"
      :src="props.src"
      :alt="props.alt"
      class="h-full w-full object-cover"
    />
    <span v-else>{{ fallbackText }}</span>
  </div>
</template>
