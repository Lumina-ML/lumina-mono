<script setup lang="ts">
interface Props {
  collapsed?: boolean;
}

defineProps<Props>();
</script>

<template>
  <aside
    :class="[
      'hidden md:flex h-screen flex-shrink-0 flex-col border-r border-border bg-canvas transition-all duration-fast',
      collapsed ? 'w-16' : 'w-56',
    ]"
  >
    <slot />
  </aside>
</template>
