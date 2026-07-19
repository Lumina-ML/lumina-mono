<script setup lang="ts">
export interface LSpinnerProps {
  size?: "sm" | "md" | "lg";
}

const props = withDefaults(defineProps<LSpinnerProps>(), {
  size: "md",
});

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};
</script>

<template>
  <div
    :class="[
      'inline-block animate-spin rounded-full border-current border-t-transparent text-muted-foreground',
      sizeClasses[props.size],
    ]"
    role="status"
    aria-label="Loading"
  />
</template>
