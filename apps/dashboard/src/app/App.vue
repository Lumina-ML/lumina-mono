<script setup lang="ts">
import { NConfigProvider, darkTheme, lightTheme } from "naive-ui";
import { Toaster } from "vue-sonner";
import { useThemeStore } from "@/stores/theme";
import { RouterView } from "vue-router";
import { computed } from "vue";

const themeStore = useThemeStore();
const theme = computed(() => (themeStore.isDark ? darkTheme : lightTheme));
</script>

<template>
  <NConfigProvider :theme="theme">
    <RouterView />
    <Toaster rich-colors position="top-right" />
  </NConfigProvider>
</template>
