<script setup lang="ts">
interface Props {
  separator?: string;
}

defineProps<Props>();
</script>

<template>
  <nav aria-label="breadcrumb">
    <ol class="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <slot />
    </ol>
  </nav>
</template>
