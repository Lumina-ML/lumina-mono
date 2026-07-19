<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  LCard,
  LButton,
  LTag,
  LDialog,
  LInput,
  LAlert,
} from "@lumina/ui";
import { Trash2, ShieldAlert } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { WorkspaceService } from "@/services/workspace.service";
import { useToast } from "@/composables/useToast";
import { useDateFormat } from "@/composables/useDateFormat";

/**
 * Profile / danger-zone page. Replaces the empty placeholder at
 * `/settings` so the dashboard has a real entry point for self-service
 * account deletion — closes the §12 gap in
 * `docs/User-Lifecycle-Flow-Audit.md`.
 */
const router = useRouter();
const authStore = useAuthStore();
const queryClient = useQueryClient();
const toast = useToast();
const { formatDate } = useDateFormat();

const deleteOpen = ref(false);
const confirmEmail = ref("");

const canDelete = computed(
  () =>
    !!authStore.user &&
    confirmEmail.value.trim().toLowerCase() ===
      (authStore.user.email ?? "").toLowerCase(),
);

const deleteMutation = useMutation({
  mutationFn: () => {
    if (!authStore.user) {
      return Promise.reject(new Error("Not signed in"));
    }
    return WorkspaceService.deleteUser(authStore.user.id);
  },
  onSuccess: () => {
    toast.success("Account deleted.");
    deleteOpen.value = false;
    authStore.logout();
    queryClient.clear();
    router.replace("/login");
  },
  onError: (e) =>
    toast.error(`Could not delete account: ${(e as Error).message}`),
});

function openDelete() {
  confirmEmail.value = "";
  deleteOpen.value = true;
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
      <p class="text-muted-foreground">
        Account-level preferences and self-service actions.
      </p>
    </div>

    <LCard title="Account">
      <div v-if="authStore.user" class="space-y-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="font-medium">{{ authStore.user.name ?? "—" }}</span>
          <LTag size="small" type="info">{{ authStore.user.email }}</LTag>
        </div>
        <div class="text-xs text-fg-tertiary">
          Joined {{ formatDate(authStore.user.createdAt) }}
        </div>
      </div>
    </LCard>

    <LCard>
      <template #header>
        <div class="flex items-center gap-2 px-4 py-3">
          <ShieldAlert class="h-4 w-4 text-accent-danger" />
          <h3 class="text-sm font-medium text-accent-danger">Danger zone</h3>
        </div>
      </template>

      <div class="space-y-3 px-4 pb-4 text-sm">
        <p class="text-fg-secondary">
          Deleting your account removes every project, run, artifact, sweep,
          report, evaluation, and trace you own. The server-side cascade is
          irreversible.
        </p>
        <div>
          <LButton type="error" @click="openDelete">
            <Trash2 class="mr-1 h-3 w-3" />
            Delete account
          </LButton>
        </div>
      </div>
    </LCard>

    <LDialog
      v-model:show="deleteOpen"
      title="Delete your account?"
      width="480px"
      @close="confirmEmail = ''"
    >
      <div class="space-y-3">
        <LAlert type="error" :show-icon="true">
          This permanently deletes your account, projects, runs, artifacts,
          and every other row tied to your user. There is no undo.
        </LAlert>

        <div class="space-y-1">
          <label
            for="confirm-email"
            class="text-xs font-medium text-fg-secondary"
          >
            Type your email
            <code class="font-mono text-fg-primary">
              {{ authStore.user?.email ?? "" }}
            </code>
            to confirm.
          </label>
          <LInput
            id="confirm-email"
            v-model:value="confirmEmail"
            :placeholder="authStore.user?.email ?? ''"
            autocomplete="off"
            spellcheck="false"
            :disabled="deleteMutation.isPending.value"
            @keydown.enter="canDelete && deleteMutation.mutate()"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton quaternary :disabled="deleteMutation.isPending.value" @click="deleteOpen = false">
            Cancel
          </LButton>
          <LButton
            type="error"
            :disabled="!canDelete"
            :loading="deleteMutation.isPending.value"
            @click="deleteMutation.mutate()"
          >
            <Trash2 class="mr-1 h-3 w-3" />
            Delete permanently
          </LButton>
        </div>
      </template>
    </LDialog>
  </div>
</template>