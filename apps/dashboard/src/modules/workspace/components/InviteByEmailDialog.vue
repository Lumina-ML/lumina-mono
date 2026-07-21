<script setup lang="ts">
import {
  LDialog,
  LButton,
  LInput,
  LSelect,
  LAlert,
  LTooltip,
  LIconButton,
} from "@lumina/ui";
import { Copy, Check, AlertTriangle, Mail } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { useApiUrl } from "@/composables/useApiUrl";
import { useInviteByEmail } from "@/modules/workspace/composables/useInviteByEmail";

/**
 * Create-and-invite dialog. See `useInviteByEmail` for the data-flow
 * comment. This component stays presentational — all state + the
 * mutation live in the composable.
 */
const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  invited: [];
}>();

const toast = useToast();
const { baseUrl } = useApiUrl();
const {
  email,
  name,
  role,
  canSubmit,
  issued,
  copied,
  inviteStep,
  inviteMutation,
  reset,
} = useInviteByEmail();

const roleOptions = [
  { label: "Owner", value: "owner" },
  { label: "Admin", value: "admin" },
  { label: "Member", value: "member" },
  { label: "Viewer", value: "viewer" },
];

// After successful invite, fire the parent event. Wrapping the composable's
// mutation here keeps the composable unaware of `emit` (which would tie it
// to a specific Vue component contract).
async function submitAndNotify() {
  await inviteMutation.mutateAsync();
  emit("invited");
}

function close() {
  emit("update:open", false);
  // Defer reset so the dialog's leave animation doesn't show empty fields.
  setTimeout(reset, 200);
}

async function copyKey() {
  if (!issued.value) return;
  try {
    await navigator.clipboard.writeText(issued.value.apiKey);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    toast.error("Could not copy key to clipboard.");
  }
}

async function copyEnvSnippet() {
  if (!issued.value) return;
  const url = baseUrl || "http://localhost:8000";
  const snippet = `# Generated from your Lumina dashboard.\n` +
    `LUMINA_API_URL=${url}\n` +
    `LUMINA_API_KEY=${issued.value.apiKey}\n`;
  await navigator.clipboard.writeText(snippet);
  toast.success(".env snippet copied");
}
</script>

<template>
  <LDialog
    :show="props.open"
    title="Invite teammate by email"
    width="520px"
    @update:show="(v: boolean) => emit('update:open', v)"
    @close="reset"
  >
    <!-- ── Form step ───────────────────────────────────────────── -->
    <div v-if="inviteStep === 'form'" class="space-y-3">
      <LAlert type="info" :show-icon="true">
        Lumina self-hosted doesn't ship with email delivery. After
        creating the account, copy the API key below and send it to your
        teammate through Slack, email, or whatever channel you trust.
      </LAlert>

      <div>
        <label
          for="invite-email"
          class="mb-1 block text-xs font-medium text-fg-secondary"
        >
          Email
        </label>
        <LInput
          id="invite-email"
          v-model:value="email"
          type="text"
          placeholder="teammate@example.com"
          autocomplete="off"
          spellcheck="false"
          :disabled="inviteMutation.isPending.value"
          @keydown.enter="canSubmit && submitAndNotify()"
        />
      </div>

      <div>
        <label
          for="invite-name"
          class="mb-1 block text-xs font-medium text-fg-secondary"
        >
          Name <span class="text-fg-tertiary">(optional)</span>
        </label>
        <LInput
          id="invite-name"
          v-model:value="name"
          placeholder="Grace Hopper"
          autocomplete="off"
          :disabled="inviteMutation.isPending.value"
        />
      </div>

      <div>
        <label
          for="invite-role"
          class="mb-1 block text-xs font-medium text-fg-secondary"
        >
          Role
        </label>
        <LSelect
          id="invite-role"
          v-model:value="role"
          :options="roleOptions"
          :disabled="inviteMutation.isPending.value"
        />
      </div>
    </div>

    <!-- ── Done step ────────────────────────────────────────────── -->
    <div v-else-if="inviteStep === 'done' && issued" class="space-y-3">
      <div class="flex items-start gap-2 rounded-md border border-accent-success/30 bg-accent-success/10 p-3 text-xs">
        <Mail class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-success" />
        <div>
          <div class="font-medium">
            Account created for {{ issued.email }}.
          </div>
          <div class="text-fg-tertiary">
            Hand them the key below through whatever channel you trust —
            they won't be able to sign in without it.
          </div>
        </div>
      </div>

      <div>
        <div class="mb-1 text-[11px] font-medium text-fg-secondary">
          API key
        </div>
        <div class="flex items-center gap-2 rounded-md border border-border bg-canvas p-2 font-mono text-xs">
          <span class="min-w-0 flex-1 truncate">{{ issued.apiKey }}</span>
          <LTooltip content="Copy">
            <LIconButton aria-label="Copy API key" @click="copyKey">
              <Check v-if="copied" class="h-3.5 w-3.5 text-accent-success" />
              <Copy v-else class="h-3.5 w-3.5" />
            </LIconButton>
          </LTooltip>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <LButton size="sm" @click="copyEnvSnippet">
          <Copy class="mr-1 h-3 w-3" />
          Copy .env snippet
        </LButton>
        <span class="text-[11px] text-fg-tertiary">
          Save as <code class="font-mono">.env</code> next to their script.
        </span>
      </div>

      <div
        class="flex items-start gap-2 rounded-md border border-accent-warning/30 bg-accent-warning/10 p-3 text-[11px]"
      >
        <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-warning" />
        <div class="text-fg-secondary">
          Lumina doesn't store the raw API key after this dialog closes.
          If your teammate loses it, ask them to sign in and rotate via
          the user menu → Rotate key.
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <LButton
          v-if="inviteStep === 'form'"
          quaternary
          :disabled="inviteMutation.isPending.value"
          @click="close"
        >
          Cancel
        </LButton>
        <LButton
          v-if="inviteStep === 'form'"
          type="primary"
          :disabled="!canSubmit"
          :loading="inviteMutation.isPending.value"
          @click="submitAndNotify()"
        >
          Create account
        </LButton>
        <LButton v-else type="primary" @click="close">Done</LButton>
      </div>
    </template>
  </LDialog>
</template>