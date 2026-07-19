<script setup lang="ts">
import { computed, ref } from "vue";
import { useQueryClient, useMutation } from "@tanstack/vue-query";
import {
  LCard,
  LButton,
  LTag,
  LSelect,
  LDialog,
  LSkeleton,
  LEmpty,
  LAvatar,
} from "@lumina/ui";
import {
  UserPlus,
  Trash2,
  Mail,
} from "lucide-vue-next";
import {
  useWorkspaceMemberships,
  useWorkspaceUsers,
} from "@/modules/workspace/composables/useWorkspaceSettings";
import { WorkspaceService, type WorkspaceRole } from "@/services/workspace.service";
import { useToast } from "@/composables/useToast";
import { useDateFormat } from "@/composables/useDateFormat";

const queryClient = useQueryClient();
const toast = useToast();
const { formatDate } = useDateFormat();

const { data: memberships, isLoading } = useWorkspaceMemberships();
const { data: users } = useWorkspaceUsers();

const inviteOpen = ref(false);
const inviteUserId = ref<string | null>(null);
const inviteRole = ref<WorkspaceRole>("member");

const availableUsers = computed(() => {
  const memberIds = new Set((memberships.value ?? []).map((m) => m.userId));
  return (users.value ?? []).filter((u) => !memberIds.has(u.id));
});

const inviteMutation = useMutation({
  mutationFn: () =>
    WorkspaceService.createMembership({
      workspaceId: "default",
      userId: inviteUserId.value!,
      role: inviteRole.value,
    }),
  onSuccess: () => {
    toast.success("Member added");
    queryClient.invalidateQueries({ queryKey: ["workspace-memberships"] });
    inviteOpen.value = false;
    inviteUserId.value = null;
  },
  onError: (e) => toast.error(`Failed to add member: ${(e as Error).message}`),
});

const roleMutation = useMutation({
  mutationFn: (input: { membershipId: string; role: WorkspaceRole }) =>
    WorkspaceService.updateMembership(input.membershipId, { role: input.role }),
  onSuccess: () => {
    toast.success("Role updated");
    queryClient.invalidateQueries({ queryKey: ["workspace-memberships"] });
  },
  onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
});

const removeMutation = useMutation({
  mutationFn: (membershipId: string) =>
    WorkspaceService.removeMembership(membershipId),
  onSuccess: () => {
    toast.success("Member removed");
    queryClient.invalidateQueries({ queryKey: ["workspace-memberships"] });
  },
  onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
});

function onChangeRole(membershipId: string, role: WorkspaceRole) {
  roleMutation.mutate({ membershipId, role });
}

function onRemove(membershipId: string, name: string) {
  if (window.confirm(`Remove ${name} from this workspace?`)) {
    removeMutation.mutate(membershipId);
  }
}

const roleColor: Record<WorkspaceRole, "default" | "info" | "primary" | "warning"> = {
  owner: "primary",
  admin: "warning",
  member: "info",
  viewer: "default",
};

const roleOptions = [
  { label: "Owner", value: "owner" },
  { label: "Admin", value: "admin" },
  { label: "Member", value: "member" },
  { label: "Viewer", value: "viewer" },
];

const userOptions = computed(() =>
  availableUsers.value.map((u) => ({
    label: u.name ? `${u.name} <${u.email}>` : u.email,
    value: u.id,
  })),
);
</script>

<template>
  <LCard class="p-0">
    <div class="flex items-center justify-between border-b border-border px-4 py-3">
      <div>
        <h3 class="text-sm font-medium">Members</h3>
        <p class="text-xs text-fg-tertiary">
          People who can access this workspace.
        </p>
      </div>
      <LButton size="sm" @click="inviteOpen = true">
        <UserPlus class="mr-1 h-3 w-3" />
        Invite member
      </LButton>
    </div>

    <LSkeleton v-if="isLoading" class="p-8" :repeat="3" />

    <LEmpty
      v-else-if="!memberships || memberships.length === 0"
      class="p-12"
      title="No members yet"
      description="Invite teammates to share runs, sweeps, and reports."
    />

    <ul v-else class="divide-y divide-border">
      <li
        v-for="m in memberships"
        :key="m.id"
        class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas"
      >
        <div class="flex min-w-0 items-center gap-3">
          <LAvatar :name="m.user?.name ?? m.user?.email ?? m.userId" size="sm" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">
              {{ m.user?.name ?? m.userId }}
            </div>
            <div class="flex items-center gap-1 truncate text-xs text-fg-tertiary">
              <Mail class="h-3 w-3" />
              {{ m.user?.email ?? "—" }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs text-fg-tertiary">
            since {{ formatDate(m.createdAt) }}
          </span>
          <LSelect
            :model-value="m.role"
            :options="roleOptions"
            size="small"
            style="width: 110px"
            @update:value="(v) => onChangeRole(m.id, String(v) as WorkspaceRole)"
          />
          <LTag :type="roleColor[m.role]" size="small">{{ m.role }}</LTag>
          <button
            type="button"
            class="rounded p-1 text-fg-tertiary hover:bg-canvas hover:text-accent-danger"
            aria-label="Remove member"
            @click="onRemove(m.id, m.user?.name ?? m.userId)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    </ul>

    <LDialog v-model:show="inviteOpen" title="Invite member" width="420px">
      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            User
          </label>
          <LSelect
            v-model:value="inviteUserId"
            :options="userOptions"
            placeholder="Select a user"
            filterable
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Role
          </label>
          <LSelect
            v-model:value="inviteRole"
            :options="roleOptions"
          />
        </div>
        <p class="text-xs text-fg-tertiary">
          {{ availableUsers.length }} user(s) available to invite.
        </p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton quaternary @click="inviteOpen = false">Cancel</LButton>
          <LButton
            :disabled="!inviteUserId"
            :loading="inviteMutation.isPending.value"
            @click="inviteMutation.mutate()"
          >
            Add member
          </LButton>
        </div>
      </template>
    </LDialog>
  </LCard>
</template>