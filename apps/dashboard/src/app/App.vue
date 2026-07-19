<script setup lang="ts">
import { Toaster } from "vue-sonner";
import { RouterView } from "vue-router";
import { LThemeProvider } from "@lumina/ui";
import { useThemeStore } from "@/stores/theme";
import CommandPalette from "@/app/providers/CommandPalette.vue";
import ConfirmHost from "@/components/ConfirmHost.vue";

const themeStore = useThemeStore();
</script>

<template>
  <LThemeProvider :dark="themeStore.isDark">
    <RouterView />
    <CommandPalette />
    <ConfirmHost />
    <Toaster rich-colors position="top-right" />
  </LThemeProvider>
</template>