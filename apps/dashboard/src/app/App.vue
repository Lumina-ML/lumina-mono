<script setup lang="ts">
import { Toaster } from "vue-sonner";
import { RouterView } from "vue-router";
import { LThemeProvider } from "@lumina/ui";
import { useThemeStore } from "@/stores/theme";

const themeStore = useThemeStore();
</script>

<template>
  <LThemeProvider :dark="themeStore.isDark">
    <RouterView />
    <Toaster rich-colors position="top-right" />
  </LThemeProvider>
</template>
