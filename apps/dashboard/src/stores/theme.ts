import { defineStore } from "pinia";
import { ref, watch } from "vue";

const THEME_KEY = "lumina:theme";

// Dark-first:仅当用户显式切到 light 才用亮色,否则一律默认暗色。
function loadInitialDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(THEME_KEY) !== "light";
}

export const useThemeStore = defineStore("theme", () => {
  const isDark = ref(loadInitialDark());

  function toggleDark() {
    isDark.value = !isDark.value;
  }

  function setDark(value: boolean) {
    isDark.value = value;
  }

  watch(
    isDark,
    (dark) => {
      if (dark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
      }
    },
    { immediate: true },
  );

  return { isDark, toggleDark, setDark };
});
