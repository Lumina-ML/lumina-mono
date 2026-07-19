import { defineStore } from "pinia";
import { computed, ref } from "vue";

const STORAGE_KEY = "lumina:project:currentId";

/**
 * Project context store. The currently selected project is used by
 * cross-project widgets (Recent Runs on the workspace overview,
 * Monitoring page, etc.) to scope their queries. Pages that already
 * have a `:projectId` route param still use that as the source of
 * truth and may set the store on enter.
 */
export const useProjectStore = defineStore("project", () => {
  const currentId = ref<string | null>(
    typeof window !== "undefined"
      ? window.localStorage.getItem(STORAGE_KEY)
      : null,
  );

  function setCurrentId(id: string | null) {
    currentId.value = id;
    if (typeof window === "undefined") return;
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore quota */
    }
  }

  const hasSelection = computed(() => Boolean(currentId.value));

  return { currentId, setCurrentId, hasSelection };
});
