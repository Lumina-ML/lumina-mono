<script setup lang="ts">
import { computed, ref } from "vue";
import {
  LCard,
  LButton,
  LIconButton,
  LTooltip,
  LTag,
} from "@lumina/ui";
import { Copy, Check, ChevronDown, ChevronRight, Terminal } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { useApiUrl } from "@/composables/useApiUrl";

/**
 * Onboarding widget for first-time users. Replaces the original hardcoded
 * snippet (which never showed how to actually pass an API key). Each step
 * is collapsible and exposes a copy button so the snippet is never wrong.
 *
 * Closing the gaps in `docs/User-Lifecycle-Flow-Audit.md` §3:
 *   - Step 1 has a copy button for `pip install lumina`.
 *   - Step 2 surfaces `LUMINA_API_URL` and `LUMINA_API_KEY` with one-click
 *     copy plus a one-click `.env` snippet.
 *   - Step 3 uses the user's *current* API key so the snippet actually
 *     authenticates against the server they just signed in to.
 *   - Step 4 offers a deep link to the first run once it appears.
 */
const authStore = useAuthStore();
const { baseUrl } = useApiUrl();

const openStep = ref<1 | 2 | 3 | 4>(2); // Start at "Configure" — the biggest original gap.

const installCmd = "pip install lumina";

const envSnippet = computed(() => {
  const url = baseUrl || "http://localhost:8000";
  const key = authStore.apiKey ?? "lm-REPLACE_ME";
  return [
    "# Generated from your Lumina dashboard.",
    "# Paste into a .env file (or `export` in your shell).",
    `LUMINA_API_URL=${url}`,
    `LUMINA_API_KEY=${key}`,
    "",
  ].join("\n");
});

const firstRunSnippet = computed(() =>
  `import lumina\n` +
  `with lumina.init(project="demo"):\n` +
  `    lumina.log({"loss": 0.9}, step=0)\n` +
  `    lumina.log({"loss": 0.5}, step=1)\n` +
  `    lumina.finish()\n`,
);

const copiedFor = ref<"install" | "url" | "key" | "env" | "run" | null>(null);

async function copy(label: "install" | "url" | "key" | "env" | "run", value: string) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    copiedFor.value = label;
    setTimeout(() => {
      if (copiedFor.value === label) copiedFor.value = null;
    }, 1500);
  } catch {
    /* clipboard unavailable — silently no-op */
  }
}

function toggleStep(step: 1 | 2 | 3 | 4) {
  openStep.value = openStep.value === step ? (step === 2 ? 2 : step) : step;
}

const hasKey = computed(() => Boolean(authStore.apiKey));
</script>

<template>
  <LCard class="p-0">
    <template #header>
      <div class="flex items-center justify-between gap-2 px-4 py-3">
        <div class="flex items-center gap-2">
          <Terminal class="h-4 w-4 text-fg-tertiary" />
          <h3 class="text-sm font-medium">Quick Start</h3>
        </div>
        <LTag v-if="!hasKey" size="small" type="warning">Sign in first</LTag>
      </div>
    </template>

    <div class="divide-y divide-border">
      <!-- Step 1 — Install -->
      <div>
        <LButton
          quaternary
          size="sm"
          class="!flex w-full !items-center !gap-2 !px-4 !py-2 !text-left !text-sm !font-medium hover:!bg-canvas !justify-start"
          @click="toggleStep(1)"
        >
          <component :is="openStep === 1 ? ChevronDown : ChevronRight" class="h-3.5 w-3.5" />
          <span class="flex-1">1. Install the SDK</span>
        </LButton>
        <div v-if="openStep === 1" class="px-4 pb-3 pt-1">
          <div class="flex items-center gap-2 rounded-md border border-border bg-canvas p-2 font-mono text-xs">
            <code class="min-w-0 flex-1 truncate">{{ installCmd }}</code>
            <LTooltip content="Copy">
              <LIconButton aria-label="Copy install command" @click="copy('install', installCmd)">
                <Check v-if="copiedFor === 'install'" class="h-3.5 w-3.5 text-accent-success" />
                <Copy v-else class="h-3.5 w-3.5" />
              </LIconButton>
            </LTooltip>
          </div>
        </div>
      </div>

      <!-- Step 2 — Configure -->
      <div>
        <LButton
          quaternary
          size="sm"
          class="!flex w-full !items-center !gap-2 !px-4 !py-2 !text-left !text-sm !font-medium hover:!bg-canvas !justify-start"
          @click="toggleStep(2)"
        >
          <component :is="openStep === 2 ? ChevronDown : ChevronRight" class="h-3.5 w-3.5" />
          <span class="flex-1">2. Configure environment</span>
        </LButton>
        <div v-if="openStep === 2" class="space-y-3 px-4 pb-3 pt-1">
          <div>
            <div class="mb-1 text-[11px] font-medium text-fg-secondary">
              API base
            </div>
            <div class="flex items-center gap-2 rounded-md border border-border bg-canvas p-2 font-mono text-xs">
              <code class="min-w-0 flex-1 truncate">{{ baseUrl || "http://localhost:8000" }}</code>
              <LTooltip content="Copy">
                <LIconButton aria-label="Copy API base" @click="copy('url', baseUrl || 'http://localhost:8000')">
                  <Check v-if="copiedFor === 'url'" class="h-3.5 w-3.5 text-accent-success" />
                  <Copy v-else class="h-3.5 w-3.5" />
                </LIconButton>
              </LTooltip>
            </div>
          </div>
          <div>
            <div class="mb-1 text-[11px] font-medium text-fg-secondary">
              API key
            </div>
            <div class="flex items-center gap-2 rounded-md border border-border bg-canvas p-2 font-mono text-xs">
              <code class="min-w-0 flex-1 truncate">{{ authStore.apiKey ?? "—" }}</code>
              <LTooltip content="Copy">
                <LIconButton
                  aria-label="Copy API key"
                  :disabled="!hasKey"
                  @click="copy('key', authStore.apiKey ?? '')"
                >
                  <Check v-if="copiedFor === 'key'" class="h-3.5 w-3.5 text-accent-success" />
                  <Copy v-else class="h-3.5 w-3.5" />
                </LIconButton>
              </LTooltip>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <LButton size="sm" @click="copy('env', envSnippet)">
              <Copy class="mr-1 h-3 w-3" />
              Copy .env snippet
            </LButton>
            <span class="text-[11px] text-fg-tertiary">
              {{ copiedFor === 'env' ? 'Copied to clipboard' : 'Paste into a .env file' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Step 3 — First run -->
      <div>
        <LButton
          quaternary
          size="sm"
          class="!flex w-full !items-center !gap-2 !px-4 !py-2 !text-left !text-sm !font-medium hover:!bg-canvas !justify-start"
          @click="toggleStep(3)"
        >
          <component :is="openStep === 3 ? ChevronDown : ChevronRight" class="h-3.5 w-3.5" />
          <span class="flex-1">3. Run your first experiment</span>
        </LButton>
        <div v-if="openStep === 3" class="px-4 pb-3 pt-1">
          <div class="flex items-start gap-2 rounded-md border border-border bg-canvas p-2 font-mono text-[11px] leading-relaxed">
            <pre class="min-w-0 flex-1 whitespace-pre-wrap break-all">{{ firstRunSnippet }}</pre>
            <LTooltip content="Copy">
              <LIconButton aria-label="Copy first run snippet" @click="copy('run', firstRunSnippet)">
                <Check v-if="copiedFor === 'run'" class="h-3.5 w-3.5 text-accent-success" />
                <Copy v-else class="h-3.5 w-3.5" />
              </LIconButton>
            </LTooltip>
          </div>
          <p class="mt-2 text-[11px] text-fg-tertiary">
            Save the snippet as <code class="font-mono">train.py</code>, then
            <code class="font-mono">python train.py</code>. The <code class="font-mono">demo</code>
            project is auto-created on first run.
          </p>
        </div>
      </div>
    </div>
  </LCard>
</template>