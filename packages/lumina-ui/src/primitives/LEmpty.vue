<script setup lang="ts">
import { NEmpty } from "naive-ui";

interface Props {
  description?: string;
  showDescription?: boolean;
  showIcon?: boolean;
}

defineProps<Props>();
</script>

<template>
  <NEmpty v-bind="$props">
    <template v-if="$slots.default" #default>
      <slot />
    </template>
    <template v-if="$slots.icon" #icon>
      <slot name="icon" />
    </template>
    <template v-if="$slots.extra" #extra>
      <slot name="extra" />
    </template>
  </NEmpty>
</template>
