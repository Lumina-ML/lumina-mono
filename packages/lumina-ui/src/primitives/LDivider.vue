<script setup lang="ts">
export interface LDividerProps {
  vertical?: boolean;
  dashed?: boolean;
}

const props = defineProps<LDividerProps>();
</script>

<template>
  <div
    :class="[
      'bg-border',
      props.vertical ? 'mx-2 inline-block h-4 w-px' : 'my-4 h-px w-full',
      props.dashed && !props.vertical ? 'border-t border-dashed border-border bg-transparent' : '',
      props.dashed && props.vertical ? 'border-l border-dashed border-border bg-transparent' : '',
    ]"
    role="separator"
    :aria-orientation="props.vertical ? 'vertical' : 'horizontal'"
  />
</template>
