import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const useThemeStore = defineStore("theme", () => {
  const isDark = ref(false);

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
    },
    { immediate: true },
  );

  return { isDark, toggleDark, setDark };
});
