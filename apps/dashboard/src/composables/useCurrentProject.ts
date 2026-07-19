import { computed, watch, type ComputedRef } from "vue";
import { useRoute } from "vue-router";
import { useProjectStore } from "@/stores/project";

/**
 * Resolve the "current project" from either the route param
 * (`/projects/:projectId/...`) or the persisted Pinia store.
 *
 * Returns a writable-ish ref:
 * - Reads from the route when the route carries a `:projectId`.
 * - Otherwise reads from the store, falling back to `null`.
 *
 * When the route carries a `:projectId` and the user navigates to a
 * non-project page, the store is updated so cross-project widgets
 * remember the last project. When the route has no `:projectId`, the
 * store value (if any) is used verbatim.
 *
 * Usage:
 *   const projectId = useCurrentProject();
 *   const { data } = useQuery({
 *     queryKey: computed(() => ["runs", projectId.value]),
 *     queryFn: () => RunService.list({ project: ... }),
 *     enabled: computed(() => !!projectId.value),
 *   });
 */
export function useCurrentProject(): ComputedRef<string | null> {
  const route = useRoute();
  const store = useProjectStore();

  // Sync the store whenever the route enters a project page.
  watch(
    () => route.params.projectId,
    (id) => {
      if (typeof id === "string") store.setCurrentId(id);
    },
    { immediate: true },
  );

  return computed<string | null>(() => {
    const routeId = route.params.projectId;
    if (typeof routeId === "string" && routeId.length > 0) {
      return routeId;
    }
    return store.currentId;
  });
}
