<script setup lang="ts">
import { ref } from "vue";
import {
  LDialog,
  LButton,
  LTooltip,
  LIconButton,
} from "@lumina/ui";
import { Copy, Check, AlertTriangle } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { useApiUrl } from "@/composables/useApiUrl";

/**
 * Shared "your new API key" disclosure dialog used by both the
 * rotate-key flow (AppLayout's account menu) and the generate-key
 * flow (SettingsApiKeys). Centralizes the warning callout + copy
 * affordance so the UX is identical across both entry points and a
 * future change to "show, then force-store" only lands once.
 */
const props = defineProps<{
  open: boolean;
  apiKey: string | null;
  /**
   * Headline above the warning icon. Rotate-key flow says the old key
   * is invalidated immediately; generate-key flow says "you won't see
   * it again".
   */
  warningTitle: string;
  /** Detail line under the headline. */
  warningDetail: string;
  /** Show the "Copy .env snippet" button — only meaningful on the
   *  generate flow where the user hasn't yet wired the key into a
   *  script. */
  showEnvSnippet?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const toast = useToast();
const { baseUrl } = useApiUrl();
const copied = ref(false);
const envCopied = ref(false);

async function copyKey() {
  if (!props.apiKey) return;
  try {
    await navigator.clipboard.writeText(props.apiKey);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    toast.error("Could not copy key to clipboard.");
  }
}

async function copyEnvSnippet() {
  if (!props.apiKey) return;
  const url = baseUrl || "http://localhost:8000";
  const snippet = `# Generated from your Lumina dashboard.\n` +
    `LUMINA_API_URL=${url}\n` +
    `LUMINA_API_KEY=${props.apiKey}\n`;
  await navigator.clipboard.writeText(snippet);
  envCopied.value = true;
  toast.success(".env snippet copied");
  setTimeout(() => (envCopied.value = false), 1500);
}
</script>

<template>
  <LDialog
    :show="open"
    title="Your new API key"
    width="520px"
    @update:show="(v: boolean) => emit('update:open', v)"
  >
    <div class="space-y-3">
      <div
        class="flex items-start gap-2 rounded-md border border-accent-warning/30 bg-accent-warning/10 p-3 text-xs"
      >
        <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-warning" />
        <div>
          <div class="font-medium">{{ warningTitle }}</div>
          <div class="text-fg-tertiary">{{ warningDetail }}</div>
        </div>
      </div>

      <div class="flex items-center gap-2 rounded-md border border-border bg-canvas p-2 font-mono text-xs">
        <span class="min-w-0 flex-1 truncate">{{ apiKey ?? "—" }}</span>
        <LTooltip content="Copy">
          <LIconButton aria-label="Copy API key" @click="copyKey">
            <Check v-if="copied" class="h-3.5 w-3.5 text-accent-success" />
            <Copy v-else class="h-3.5 w-3.5" />
          </LIconButton>
        </LTooltip>
      </div>

      <div v-if="showEnvSnippet" class="flex flex-wrap items-center gap-2">
        <LButton size="sm" @click="copyEnvSnippet">
          <Copy class="mr-1 h-3 w-3" />
          {{ envCopied ? "Copied .env snippet" : "Copy .env snippet" }}
        </LButton>
        <span class="text-[11px] text-fg-tertiary">
          Save it as <code class="font-mono">.env</code> next to your script.
        </span>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <LButton @click="emit('update:open', false)">I've stored it</LButton>
      </div>
    </template>
  </LDialog>
</template>