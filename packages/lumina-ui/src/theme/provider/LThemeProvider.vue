<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { NConfigProvider, darkTheme, type GlobalThemeOverrides } from "naive-ui";
import { luminaThemeOverrides, resolveThemeOverrides } from "../naive-theme";

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

// naive-ui 的 seemly 无法解析 `hsl(var(--x))`，需在运行时解析成具体色值。
// dark 变化时先切换 class，再基于生效的 CSS 变量重算 overrides。
const resolvedOverrides = ref<GlobalThemeOverrides>(luminaThemeOverrides);

watchEffect(() => {
  const el = targetElement.value;
  if (!el) return;
  if (props.dark) {
    el.classList.add("dark");
  } else {
    el.classList.remove("dark");
  }
  resolvedOverrides.value = resolveThemeOverrides(luminaThemeOverrides, el);
});
</script>

<template>
  <NConfigProvider :theme="props.dark ? darkTheme : null" :theme-overrides="resolvedOverrides">
    <slot />
  </NConfigProvider>
</template>
