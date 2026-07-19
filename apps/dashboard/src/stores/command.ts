import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useCommandStore = defineStore("command", () => {
  const open = ref(false);
  const query = ref("");

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  function show() {
    open.value = true;
    query.value = "";
  }

  function hide() {
    open.value = false;
    query.value = "";
  }

  function toggle() {
    if (open.value) hide();
    else show();
  }

  const shortcutLabel = computed(() => (isMac ? "⌘K" : "Ctrl K"));

  return { open, query, shortcutLabel, show, hide, toggle };
});