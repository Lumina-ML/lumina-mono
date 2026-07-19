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
 * Store sync rules (see [[project-store-pollution-fix]]):
 * - When the user enters a project route, the store is updated so that
 *   cross-project widgets (workspace overview "Recent runs", monitoring,
 *   etc.) remember which project they last visited.
 * - When the user navigates to a non-project route (Workspace Home,
 *   Model Registry, Settings, global stub pages, ...), the store is
 *   cleared. Without this, `useCurrentProject` would fall back to a
 *   stale project id and scope widgets that should be workspace-wide.
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

  // Sync the store: enter-project writes, leave-project clears.
  // Watching route.params.projectId alone isn't sufficient — the params
  // may stay populated while the user is on a workspace-level route that
  // happens to share a param name, or stay empty while the project page
  // is being mounted. Watching both `name` and `params.projectId` keeps
  // the invariant simple: route carries a project id → store has it;
  // route does not → store is null.
  watch(
    () => [route.name, route.params.projectId] as const,
    ([, id]) => {
      if (typeof id === "string" && id.length > 0) {
        store.setCurrentId(id);
      } else {
        store.setCurrentId(null);
      }
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
