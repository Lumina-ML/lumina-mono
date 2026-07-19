import { computed, type ComputedRef } from "vue";
import { useWorkspaceStore } from "@/stores/workspace";

/**
 * Build a reactive `workspace:<id>` channel name from the current workspace
 * selection. Use as the `channel` argument to `useRealtimeSubscription` so
 * the subscription re-targets automatically when the user switches
 * workspaces via the sidebar switcher.
 *
 *   const channel = useWorkspaceChannel();
 *   useRealtimeSubscription(channel, (e) => { ... });
 */
export function useWorkspaceChannel(): ComputedRef<string> {
  const store = useWorkspaceStore();
  return computed(() => `workspace:${store.currentId}`);
}
