<script setup lang="ts">
import { computed, ref } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  LCard,
  LButton,
  LTag,
  LSkeleton,
  LDialog,
  LTooltip,
  LIconButton,
} from "@lumina/ui";
import { Copy, Check, Key, RotateCw, AlertTriangle } from "lucide-vue-next";
import { WorkspaceService } from "@/services/workspace.service";
import { useWorkspaceUsers } from "@/modules/workspace/composables/useWorkspaceSettings";
import { useToast } from "@/composables/useToast";
import { useDateFormat } from "@/composables/useDateFormat";
import { useApiUrl } from "@/composables/useApiUrl";

const queryClient = useQueryClient();
const toast = useToast();
const { formatDate } = useDateFormat();
void formatDate;
const { baseUrl } = useApiUrl();

const { data: users, isLoading } = useWorkspaceUsers();
const currentUserId = ref<string | null>(null);

// Once a key has been generated, we display it ONCE so the user can copy it.
// After they dismiss the dialog the value is cleared from memory.
const generatedKey = ref<string | null>(null);
const generatedDialogOpen = ref(false);
const copied = ref(false);
const envCopied = ref(false);

const envSnippet = computed(() => {
  if (!generatedKey.value) return "";
  const url = baseUrl || "http://localhost:8000";
  return `# Generated from your Lumina dashboard.\n` +
    `LUMINA_API_URL=${url}\n` +
    `LUMINA_API_KEY=${generatedKey.value}\n`;
});

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

async function copy() {
  if (!generatedKey.value) return;
  await navigator.clipboard.writeText(generatedKey.value);
  copied.value = true;
  toast.success("API key copied");
  setTimeout(() => (copied.value = false), 1500);
}

async function copyEnvSnippet() {
  if (!envSnippet.value) return;
  await navigator.clipboard.writeText(envSnippet.value);
  envCopied.value = true;
  toast.success(".env snippet copied");
  setTimeout(() => (envCopied.value = false), 1500);
}

function revoke() {
  if (!currentUserId.value) return;
  if (
    !window.confirm(
      "Revoke this API key? Any active clients using it will start receiving 401s immediately.",
    )
  ) {
    return;
  }
  // Backend has no list/revoke endpoints yet — surface intent + rotate by
  // re-generating.
  toast.warning("Revoke isn't wired yet — generating a new key as a stopgap.");
  generateMutation.mutate(currentUserId.value);
}

function dismiss() {
  generatedKey.value = null;
  generatedDialogOpen.value = false;
  envCopied.value = false;
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
        <select
          v-model="currentUserId"
          class="rounded-md border border-border bg-card px-2 py-1 text-xs"
        >
          <option :value="null" disabled>Pick a user…</option>
          <option
            v-for="u in users ?? []"
            :key="u.id"
            :value="u.id"
          >
            {{ u.name ?? u.email }}
          </option>
        </select>
      </div>
    </div>

    <LDialog
      v-model:show="generatedDialogOpen"
      title="Your new API key"
      width="520px"
      @close="dismiss"
    >
      <div class="space-y-3">
        <div
          class="flex items-start gap-2 rounded-md border border-accent-warning/30 bg-accent-warning/10 p-3 text-xs"
        >
          <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-warning" />
          <div>
            <div class="font-medium">Copy this key now — you won't see it again.</div>
            <div class="text-fg-tertiary">
              Store it in your password manager or environment variables (e.g.
              <code class="font-mono">LUMINA_API_KEY</code>).
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 rounded-md border border-border bg-canvas p-2 font-mono text-xs">
          <span class="min-w-0 flex-1 truncate">{{ generatedKey }}</span>
          <LTooltip content="Copy">
            <LIconButton aria-label="Copy" @click="copy">
              <Check v-if="copied" class="h-3.5 w-3.5 text-accent-success" />
              <Copy v-else class="h-3.5 w-3.5" />
            </LIconButton>
          </LTooltip>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <LButton size="sm" @click="copyEnvSnippet">
            <Copy class="mr-1 h-3 w-3" />
            {{ envCopied ? 'Copied .env snippet' : 'Copy .env snippet' }}
          </LButton>
          <span class="text-[11px] text-fg-tertiary">
            Save it as <code class="font-mono">.env</code> next to your script.
          </span>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <LButton @click="dismiss">I've stored it</LButton>
        </div>
      </template>
    </LDialog>
  </LCard>
</template>

<script lang="ts">
// Re-import Trash2 lazily to avoid the unused-import warning when this SFC is
// tree-shaken into a route's chunk (TS reports it as unused otherwise).
import { Trash2 } from "lucide-vue-next";
export default { components: { Trash2 } };
</script>