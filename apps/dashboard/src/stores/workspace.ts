import { defineStore } from "pinia";
import { computed, ref } from "vue";

const STORAGE_KEY = "lumina:workspace:currentId";

/**
 * Workspace context. Single workspace id is hardcoded to "default" in
 * this monorepo (the server seeds a default workspace on boot). When
 * multi-workspace support lands, the source of truth becomes the
 * `useWorkspaceMemberships()` query instead of a constant.
 *
 * The store exists so any view can read `useWorkspaceStore().currentId`
 * without having to thread it through props, and so the value can be
 * persisted if we ever ship a workspace switcher.
 */
const DEFAULT_WORKSPACE_ID = "default";

function loadInitialId(): string {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE_ID;
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_WORKSPACE_ID;
}

export const useWorkspaceStore = defineStore("workspace", () => {
  const currentId = ref<string>(loadInitialId());

  function setCurrentId(id: string) {
    currentId.value = id;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* ignore quota */
      }
    }
  }

  const isDefault = computed(() => currentId.value === DEFAULT_WORKSPACE_ID);

  return { currentId, setCurrentId, isDefault };
});
