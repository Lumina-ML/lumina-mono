<script setup lang="ts">
import { computed, ref } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
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
import {
  WorkspaceService,
  DEFAULT_WORKSPACE_ID,
  type WorkspaceRole,
  type CreateUserResult,
} from "@/services/workspace.service";
import { useToast } from "@/composables/useToast";
import { useApiUrl } from "@/composables/useApiUrl";

/**
 * Create-and-invite dialog. Closes the §7 gap in
 * `docs/User-Lifecycle-Flow-Audit.md` — previously the only invite path
 * required the teammate to already exist on the server, so admins were
 * forced to share keys out-of-band.
 *
 * Flow:
 *   1. Admin enters email + (optional) name + role.
 *   2. We POST /api/v1/users (server issues a fresh apiKey).
 *   3. We POST /api/v1/workspace-memberships to attach them.
 *   4. We display the apiKey in a copyable box. Admin sends it to the
 *      teammate via Slack / email / carrier pigeon.
 *
 * Self-hosted Lumina can't deliver email out of the box (no SMTP
 * configured), so the magic-link / short-URL variant is left as a
 * follow-up — see audit §7 for the longer-term shape.
 */
const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  invited: [];
}>();

const toast = useToast();
const queryClient = useQueryClient();
const { baseUrl } = useApiUrl();

const email = ref("");
const name = ref("");
const role = ref<WorkspaceRole>("member");

const roleOptions = [
  { label: "Owner", value: "owner" },
  { label: "Admin", value: "admin" },
  { label: "Member", value: "member" },
  { label: "Viewer", value: "viewer" },
];

const issued = ref<CreateUserResult | null>(null);
const copied = ref(false);
const inviteStep = ref<"form" | "done">("form");

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

function close() {
  emit("update:open", false);
  // Defer reset so the dialog's leave animation doesn't show empty fields.
  setTimeout(reset, 200);
}

const inviteMutation = useMutation({
  mutationFn: async () => {
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
      // User is already on the server but not in this workspace — surface
      // it but keep the apiKey visible so the admin can still hand it
      // over. The membership call can be retried from the existing-user
      // branch.
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
    emit("invited");
  },
  onError: (e) => {
    toast.error(`Invite failed: ${(e as Error).message}`);
  },
});

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
          type="email"
          placeholder="teammate@example.com"
          autocomplete="off"
          spellcheck="false"
          :disabled="inviteMutation.isPending.value"
          @keydown.enter="canSubmit && inviteMutation.mutate()"
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
          @click="inviteMutation.mutate()"
        >
          Create account
        </LButton>
        <LButton v-else type="primary" @click="close">Done</LButton>
      </div>
    </template>
  </LDialog>
</template>