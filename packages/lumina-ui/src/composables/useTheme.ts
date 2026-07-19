import { ref, computed, watchEffect } from "vue";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "lumina-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): ThemeMode {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

/**
 * 主题管理 Composable。
 *
 * 监听系统主题变化，支持持久化到 localStorage，并在 document.documentElement 上切换 .dark。
 */
export function useTheme() {
  const mode = ref<ThemeMode>(getStoredTheme());

  const resolvedMode = computed<"light" | "dark">(() => {
    if (mode.value === "system") return getSystemTheme();
    return mode.value;
  });

  const isDark = computed(() => resolvedMode.value === "dark");

  function setMode(next: ThemeMode) {
    mode.value = next;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }

  function toggleDark() {
    setMode(isDark.value ? "light" : "dark");
  }

  watchEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (isDark.value) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  });

  return {
    mode,
    resolvedMode,
    isDark,
    setMode,
    toggleDark,
  };
}
