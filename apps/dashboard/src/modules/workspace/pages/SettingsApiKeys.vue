<script setup lang="ts">
import { ref } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  LCard,
  LButton,
  LTag,
  LSkeleton,
  LSelect,
} from "@lumina/ui";
import { Key, RotateCw } from "lucide-vue-next";
import { WorkspaceService } from "@/services/workspace.service";
import { useWorkspaceUsers } from "@/modules/workspace/composables/useWorkspaceSettings";
import { useToast } from "@/composables/useToast";
import { useConfirm } from "@/composables/useConfirm";
import ApiKeyDialog from "@/modules/workspace/components/ApiKeyDialog.vue";

const queryClient = useQueryClient();
const toast = useToast();
const { confirm } = useConfirm();

const { data: users, isLoading } = useWorkspaceUsers();
const currentUserId = ref<string | null>(null);

// Once a key has been generated, we display it ONCE so the user can copy it.
// After they dismiss the dialog the value is cleared from memory.
const generatedKey = ref<string | null>(null);
const generatedDialogOpen = ref(false);

const generateMutation = useMutation({
  mutationFn: (userId: string) => WorkspaceService.generateApiKey(userId),
  onSuccess: (data) => {
    generatedKey.value = data.apiKey;
    generatedDialogOpen.value = true;
    queryClient.invalidateQueries({ queryKey: ["workspace-users"] });
  },
  onError: (e) =>
    toast.error(`Failed to generate key: ${(e as Error).message}`),
});

function generate() {
  if (!currentUserId.value) {
    toast.warning("Pick a user first.");
    return;
  }
  generateMutation.mutate(currentUserId.value);
}

async function revoke() {
  if (!currentUserId.value) return;
  const ok = await confirm({
    title: "Revoke this API key?",
    message:
      "Any active clients using it will start receiving 401s immediately.",
    confirmText: "Revoke key",
    tone: "danger",
  });
  if (!ok) return;
  // Backend has no list/revoke endpoints yet — surface intent + rotate by
  // re-generating.
  toast.warning("Revoke isn't wired yet — generating a new key as a stopgap.");
  generateMutation.mutate(currentUserId.value);
}

function dismiss() {
  generatedKey.value = null;
  generatedDialogOpen.value = false;
}

const apiKeyEnv = import.meta.env.VITE_LUMINA_API_KEY as string | undefined;
const currentKeyPreview = apiKeyEnv
  ? `${apiKeyEnv.slice(0, 6)}…${apiKeyEnv.slice(-4)}`
  : "—";
</script>

<template>
  <LCard class="p-0">
    <div class="flex items-center justify-between border-b border-border px-4 py-3">
      <div>
        <h3 class="text-sm font-medium">API keys</h3>
        <p class="text-xs text-fg-tertiary">
          Personal access tokens used by the SDK and CLI.
        </p>
      </div>
      <LButton size="sm" @click="generate" :loading="generateMutation.isPending.value">
        <RotateCw class="mr-1 h-3 w-3" />
        Generate new key
      </LButton>
    </div>

    <LSkeleton v-if="isLoading" class="p-8" :repeat="2" />

    <div v-else class="divide-y divide-border">
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex min-w-0 items-center gap-3">
          <Key class="h-4 w-4 text-fg-tertiary" />
          <div class="min-w-0">
            <div class="text-sm font-medium">Active key</div>
            <div class="font-mono text-xs text-fg-tertiary">
              {{ currentKeyPreview }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <LTag size="small" type="success">Active</LTag>
          <LButton size="sm" quaternary @click="revoke">
            <Trash2 class="mr-1 h-3 w-3" />
            Revoke
          </LButton>
        </div>
      </div>

      <div class="flex items-center justify-between px-4 py-3 text-xs text-fg-tertiary">
        <span>
          Keys are scoped per user. Pick a user to generate or revoke theirs.
        </span>
        <LSelect
          v-model="currentUserId"
          size="small"
          placeholder="Pick a user…"
        >
          <option :value="null" disabled>Pick a user…</option>
          <option
            v-for="u in users ?? []"
            :key="u.id"
            :value="u.id"
          >
            {{ u.name ?? u.email }}
          </option>
        </LSelect>
      </div>
    </div>

    <ApiKeyDialog
      v-model:open="generatedDialogOpen"
      :api-key="generatedKey"
      warning-title="Copy this key now — you won't see it again."
      warning-detail="Store it in your password manager or environment variables (e.g. LUMINA_API_KEY)."
      :show-env-snippet="true"
      @update:open="dismiss"
    />
  </LCard>
</template>

<script lang="ts">
// Re-import Trash2 lazily to avoid the unused-import warning when this SFC is
// tree-shaken into a route's chunk (TS reports it as unused otherwise).
import { Trash2 } from "lucide-vue-next";
export default { components: { Trash2 } };
</script>