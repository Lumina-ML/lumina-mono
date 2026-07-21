import { computed, ref } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  WorkspaceService,
  DEFAULT_WORKSPACE_ID,
  type WorkspaceRole,
  type CreateUserResult,
} from "@/services/workspace.service";
import { useToast } from "@/composables/useToast";

export type InviteStep = "form" | "done";

/**
 * State + mutation for the invite-by-email dialog. Lives in
 * `composables/` so the dialog component (`InviteByEmailDialog.vue`)
 * stays a thin template over the form / done-step views.
 *
 * Two-phase server flow:
 *   1. `WorkspaceService.createUser` — issues a fresh API key.
 *   2. `WorkspaceService.createMembership` — attaches to the default
 *      workspace. We swallow errors here so the admin can still hand
 *      off the API key to an existing user (the membership call can
 *      be retried from the existing-user branch).
 */
export function useInviteByEmail() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const email = ref("");
  const name = ref("");
  const role = ref<WorkspaceRole>("member");
  const issued = ref<CreateUserResult | null>(null);
  const copied = ref(false);
  const inviteStep = ref<InviteStep>("form");

  const canSubmit = computed(() => {
    const trimmed = email.value.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  });

  function reset() {
    email.value = "";
    name.value = "";
    role.value = "member";
    issued.value = null;
    copied.value = false;
    inviteStep.value = "form";
  }

  const inviteMutation = useMutation({
    mutationFn: async (): Promise<CreateUserResult> => {
      const trimmedEmail = email.value.trim();
      const trimmedName = name.value.trim();
      const created = await WorkspaceService.createUser({
        email: trimmedEmail,
        ...(trimmedName ? { name: trimmedName } : {}),
      });
      try {
        await WorkspaceService.createMembership({
          workspaceId: DEFAULT_WORKSPACE_ID,
          userId: created.id,
          role: role.value,
        });
      } catch (membershipErr) {
        toast.warning(
          `User created but couldn't auto-attach to workspace: ${(membershipErr as Error).message}. Add them via the existing-user tab.`,
        );
      }
      return created;
    },
    onSuccess: (created) => {
      issued.value = created;
      inviteStep.value = "done";
      queryClient.invalidateQueries({ queryKey: ["workspace-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-users"] });
    },
    onError: (e) => {
      toast.error(`Invite failed: ${(e as Error).message}`);
    },
  });

  return {
    // form state
    email,
    name,
    role,
    canSubmit,
    // post-submit state
    issued,
    copied,
    inviteStep,
    // mutation + helpers
    inviteMutation,
    reset,
  };
}