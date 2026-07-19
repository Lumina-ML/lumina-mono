<script setup lang="ts">
import { computed, watchEffect } from "vue";

interface Props {
  /** 是否强制暗色模式 */
  dark?: boolean;
  /** 自定义作用域选择器，默认 document.documentElement */
  target?: string;
}

const props = defineProps<Props>();

const targetElement = computed<HTMLElement | null>(() => {
  if (typeof document === "undefined") return null;
  return props.target ? document.querySelector(props.target) : document.documentElement;
});

watchEffect(() => {
  const el = targetElement.value;
  if (!el) return;
  if (props.dark) {
    el.classList.add("dark");
  } else {
    el.classList.remove("dark");
  }
});
</script>

<template>
  <slot />
</template>
