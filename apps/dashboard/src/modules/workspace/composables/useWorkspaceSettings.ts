import { useQuery } from "@tanstack/vue-query";
import { computed, type Ref } from "vue";
import { WorkspaceService } from "@/services/workspace.service";

/**
 * Single workspace id is hardcoded to "default" in this monorepo until we wire
 * real workspace switching. See CLAUDE.md ("default" workspaceId seed).
 */
const WORKSPACE_ID = "default";

export const DEFAULT_WORKSPACE_ID = WORKSPACE_ID;

export function useWorkspaceMemberships() {
  return useQuery({
    queryKey: ["workspace-memberships", WORKSPACE_ID],
    queryFn: () => WorkspaceService.listMemberships(WORKSPACE_ID),
  });
}

export function useWorkspaceUsers() {
  return useQuery({
    queryKey: ["workspace-users"],
    queryFn: () => WorkspaceService.listUsers(),
  });
}

/**
 * Resolves a workspaceId from a possibly-undefined ref. Returns the default
 * workspace when the route doesn't carry one.
 */
export function resolveWorkspaceId(_maybeId: Ref<string | undefined> | undefined) {
  return computed(() => WORKSPACE_ID);
}