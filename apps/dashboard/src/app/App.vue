<script setup lang="ts">
import { Toaster } from "vue-sonner";
import { useRouter, RouterView } from "vue-router";
import { LButton, LErrorBoundary, LThemeProvider } from "@lumina/ui";
import { useThemeStore } from "@/stores/theme";
import CommandPalette from "@/app/providers/CommandPalette.vue";
import ConfirmHost from "@/components/ConfirmHost.vue";

const themeStore = useThemeStore();
const router = useRouter();

/**
 * Reset the caught error and reload the current route. The
 * `LErrorBoundary`'s default `reset()` clears its internal state; we
 * then push to the same URL so any module-scoped reactive state in
 * the failed component re-initializes.
 */
function recover() {
  // Reset by navigating: drop the query / hash so identical-URL
  // routes still trigger a fresh setup pass.
  const { path, query, hash } = router.currentRoute.value;
  void router.replace({ path, query, hash }).then(() => {
    // Soft reload the current view; if the same error re-fires it
    // bubbles up here again and the user can navigate manually.
    router.go(0);
  });
}
</script>

<template>
  <LThemeProvider :dark="themeStore.isDark">
    <LErrorBoundary>
      <RouterView />
      <template #action>
        <LButton size="sm" @click="recover">Retry</LButton>
      </template>
    </LErrorBoundary>
    <CommandPalette />
    <ConfirmHost />
    <Toaster rich-colors position="top-right" />
  </LThemeProvider>
</template>