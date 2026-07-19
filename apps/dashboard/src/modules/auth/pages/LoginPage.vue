<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute, RouterLink } from "vue-router";
import {
  LCard,
  LInput,
  LButton,
  LAlert,
  LTag,
} from "@lumina/ui";
import { KeyRound, Eye, EyeOff, ExternalLink, Github } from "lucide-vue-next";
import { useAuth } from "@/modules/auth/composables/useAuth";
import BrandMark from "@/components/BrandMark.vue";

const router = useRouter();
const route = useRoute();
const auth = useAuth();

const apiKey = ref("");
const showKey = ref(false);
const submitting = ref(false);
const localError = ref<string | null>(null);

// If the URL has `?key=lm-…` (e.g. arriving from a "copy link with key"
// bookmark), prefill it.
onMounted(() => {
  const qKey = route.query.key;
  if (typeof qKey === "string" && qKey.length > 0) {
    apiKey.value = qKey;
  }
});

async function onSubmit() {
  localError.value = null;
  if (!apiKey.value.trim()) {
    localError.value = "Please paste an API key.";
    return;
  }
  submitting.value = true;
  try {
    const user = await auth.login(apiKey.value);
    if (user) {
      const target =
        typeof route.query.redirect === "string" ? route.query.redirect : "/";
      router.replace(target);
    }
  } catch (err) {
    localError.value = err instanceof Error ? err.message : "Login failed.";
  } finally {
    submitting.value = false;
  }
}

const apiBase = import.meta.env.VITE_LUMINA_API_URL || "(default — same origin)";
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background">
    <!-- Header strip -->
    <header class="flex items-center justify-between border-b border-border px-6 py-3">
      <RouterLink to="/login" class="flex items-center gap-2">
        <BrandMark :size="24" :show-wordmark="true" />
      </RouterLink>
      <a
        href="https://github.com/Lumina-ML/lumina"
        target="_blank"
        rel="noreferrer noopener"
        class="inline-flex items-center gap-1 text-xs text-fg-tertiary hover:text-fg-primary"
      >
        <Github class="h-3.5 w-3.5" />
        Source
      </a>
    </header>

    <!-- Body -->
    <div class="flex flex-1 items-center justify-center p-6">
      <div class="w-full max-w-md space-y-6">
        <div class="text-center">
          <BrandMark :size="48" :show-wordmark="false" class="mx-auto mb-3" />
          <h1 class="text-2xl font-semibold tracking-tight">Sign in to Lumina</h1>
          <p class="mt-1 text-sm text-fg-tertiary">
            Paste an API key to access your workspace.
          </p>
        </div>

        <LCard class="p-6">
          <form class="space-y-4" @submit.prevent="onSubmit">
            <div>
              <label
                for="apiKey"
                class="mb-1 block text-xs font-medium text-fg-secondary"
              >
                API key
              </label>
              <LInput
                id="apiKey"
                v-model:value="apiKey"
                :type="showKey ? 'text' : 'password'"
                placeholder="lm-..."
                size="large"
                autocomplete="off"
                spellcheck="false"
                :disabled="submitting"
                @keydown.enter.prevent="onSubmit"
              >
                <template #prefix>
                  <KeyRound class="h-4 w-4 text-fg-tertiary" />
                </template>
                <template #suffix>
                  <button
                    type="button"
                    class="flex h-7 w-7 items-center justify-center rounded text-fg-tertiary hover:bg-canvas"
                    :aria-label="showKey ? 'Hide API key' : 'Show API key'"
                    @click="showKey = !showKey"
                  >
                    <EyeOff v-if="showKey" class="h-4 w-4" />
                    <Eye v-else class="h-4 w-4" />
                  </button>
                </template>
              </LInput>
              <p class="mt-1 text-[11px] text-fg-tertiary">
                API base: <code class="font-mono">{{ apiBase }}</code>
              </p>
            </div>

            <LAlert
              v-if="localError || auth.error.value"
              type="error"
              :show-icon="true"
            >
              {{ localError || auth.error.value }}
            </LAlert>

            <LButton
              type="primary"
              size="lg"
              :loading="submitting"
              :disabled="!apiKey.trim()"
              class="!w-full"
              @click="onSubmit"
            >
              {{ submitting ? "Signing in…" : "Sign in" }}
            </LButton>
          </form>
        </LCard>

        <LCard class="p-4 text-sm">
          <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
            Don't have a key yet?
          </h2>
          <ol class="ml-4 list-decimal space-y-1 text-fg-secondary">
            <li>
              Start the server with
              <code class="font-mono">docker compose up</code>.
            </li>
            <li>
              Open <code class="font-mono">http://localhost:5173</code> on
              first boot to land on this page.
            </li>
            <li>
              Hit
              <code class="font-mono">POST /api/v1/users</code> with
              <code class="font-mono">{ "email": "you@example.com" }</code>
              to create a user.
            </li>
            <li>
              Generate a key with
              <code class="font-mono">POST /api/v1/users/&lt;id&gt;/api-key</code>.
            </li>
          </ol>
          <p class="mt-3 text-xs text-fg-tertiary">
            <LTag size="small" type="info">Tip</LTag>
            You can also bake a key into the build via
            <code class="font-mono">VITE_LUMINA_API_KEY</code>.
            <ExternalLink class="ml-1 inline h-3 w-3" />
          </p>
        </LCard>
      </div>
    </div>
  </div>
</template>
